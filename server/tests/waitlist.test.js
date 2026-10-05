import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Event from "../models/Event.js";
import { startApp, startDb } from "./helpers.js";

const HOUR = 60 * 60 * 1000;

let stopDb;
let api;
let admin;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
});

after(async () => {
  await api.stop();
  await stopDb();
});

const users = (n, gender = "brother") =>
  Promise.all(Array.from({ length: n }, () => api.makeUser({ gender })));
const register = (u, id) => api.call(u, "POST", `/api/events/${id}/register`);
const cancel = (u, id) => api.call(u, "DELETE", `/api/events/${id}/register`);
const join = (u, id) => api.call(u, "POST", `/api/events/${id}/waitlist`);
const leave = (u, id) => api.call(u, "DELETE", `/api/events/${id}/waitlist`);
const view = async (u, id) => (await api.call(u, "GET", `/api/events/${id}`)).body;

// Brothers event of `max` spots, filled by `holders`, then `waiters` join in order.
const fullEvent = async ({ max = 1, holders = 1, waiters = 0, sisters = 0 } = {}) => {
  const id = await api.makeEvent(admin, { brothersMax: max, sistersMax: sisters });
  const held = await users(holders);
  for (const u of held) assert.equal((await register(u, id)).status, 200);
  const waiting = await users(waiters);
  for (const u of waiting) assert.equal((await join(u, id)).status, 200);
  return { id, held, waiting };
};

// Invariants that must hold after anything.
const assertSound = async (id) => {
  const event = await Event.findById(id);
  for (const gender of ["brother", "sister"]) {
    const max = event[`${gender}sMax`];
    const registered = event.volunteers.filter((v) => v.gender === gender).length;
    const waiting = event.waitlist.filter((w) => w.gender === gender).length;
    assert.ok(registered <= max, `${gender}s over-filled: ${registered}/${max}`);
    if (waiting > 0) assert.equal(registered, max, `${gender} spot left open while people wait`);
  }
  const inBoth = event.waitlist.filter((w) => event.volunteers.some((v) => v.user.equals(w.user)));
  assert.equal(inBoth.length, 0, "nobody is registered and waiting at once");
  return event;
};

describe("joining and leaving", () => {
  test("you can only join when your group is full", async () => {
    const id = await api.makeEvent(admin, { brothersMax: 2 });
    const [v] = await users(1);
    const res = await join(v, id);
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "A spot is open, so you can register instead");
  });

  test("positions are per group and in joining order", async () => {
    const { id, waiting } = await fullEvent({ waiters: 3, sisters: 1 });
    for (const [i, u] of waiting.entries()) {
      assert.equal((await view(u, id)).myWaitlistPosition, i + 1);
    }
    const [s1, s2] = await users(2, "sister");
    await register(s1, id);
    assert.equal((await join(s2, id)).body.myWaitlistPosition, 1, "sisters queue separately");
    const counts = await view(admin, id);
    assert.equal(counts.brothersWaitlisted, 3);
    assert.equal(counts.sistersWaitlisted, 1);
  });

  test("refusals: twice, already registered, group not needed, deleted", async () => {
    const { id, held, waiting } = await fullEvent({ waiters: 1 });
    let res = await join(waiting[0], id);
    assert.equal(res.body.message, "You're already on the waitlist");
    res = await join(held[0], id);
    assert.equal(res.body.message, "You are already registered");
    const [sister] = await users(1, "sister");
    res = await join(sister, id);
    assert.equal(res.body.message, "This event does not need sisters");

    const gone = await api.makeEvent(admin, { brothersMax: 1 });
    await api.call(admin, "DELETE", `/api/events/${gone}`);
    assert.equal((await join(sister, gone)).status, 410);
  });

  test("leaving moves everyone behind up; rejoining goes to the back; leaving twice is fine", async () => {
    const { id, waiting: [a, b, c] } = await fullEvent({ waiters: 3 });
    const res = await leave(a, id);
    assert.equal(res.status, 200);
    assert.equal(res.body.myWaitlistPosition, null);
    assert.equal((await view(b, id)).myWaitlistPosition, 1);
    assert.equal((await view(c, id)).myWaitlistPosition, 2);
    assert.equal((await leave(a, id)).status, 200);
    assert.equal((await join(a, id)).body.myWaitlistPosition, 3);
  });

  test("registering can't jump the waitlist", async () => {
    const { id } = await fullEvent({ max: 1, waiters: 1 });
    // Force a free spot without promotion, as if mid-race.
    await Event.updateOne({ _id: id }, { $set: { brothersMax: 2 } });
    const [jumper] = await users(1);
    const res = await register(jumper, id);
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "There's a waitlist for brothers. Join it to get the next spot.");
  });
});

describe("promotion", () => {
  test("spots go to the waitlist in joining order", async () => {
    const { id, held: [holder], waiting: [a, b, c] } = await fullEvent({ waiters: 3 });

    await cancel(holder, id);
    let aView = await view(a, id);
    assert.equal(aView.myStatus, "registered");
    assert.ok(aView.myPromotedAt);
    assert.equal((await view(b, id)).myWaitlistPosition, 1);

    await cancel(a, id);
    assert.equal((await view(b, id)).myStatus, "registered");
    await cancel(b, id);
    assert.equal((await view(c, id)).myStatus, "registered");
    await assertSound(id);
  });

  test("a brother's spot never goes to a sister", async () => {
    const id = await api.makeEvent(admin, { brothersMax: 1, sistersMax: 1 });
    const [brother] = await users(1);
    const [s1, s2] = await users(2, "sister");
    await register(brother, id);
    await register(s1, id);
    await join(s2, id);

    await cancel(brother, id);
    assert.equal((await view(s2, id)).myStatus, null);
    assert.equal((await view(s2, id)).myWaitlistPosition, 1);
    await assertSound(id);
  });

  test("two cancels at the same moment promote the first two, in order", async () => {
    for (let round = 0; round < 5; round++) {
      const { id, held, waiting: [w1, w2, w3] } = await fullEvent({ max: 2, holders: 2, waiters: 3 });
      const results = await Promise.all(held.map((u) => cancel(u, id)));
      assert.ok(results.every((r) => r.status === 200));

      assert.equal((await view(w1, id)).myStatus, "registered", `round ${round}`);
      assert.equal((await view(w2, id)).myStatus, "registered", `round ${round}`);
      assert.equal((await view(w3, id)).myWaitlistPosition, 1, `round ${round}`);
      await assertSound(id);
    }
  });

  test("never promoted into a full group, even with cancels, joins, leaves and edits racing", async () => {
    const { id, held, waiting } = await fullEvent({ max: 2, holders: 2, waiters: 4 });
    const extra = await users(6);
    const edit = (brothersMax) =>
      api.call(admin, "PATCH", `/api/events/${id}`, {
        name: "Race",
        date: new Date(Date.now() + 48 * HOUR).toISOString(),
        location: "Hall",
        hours: 2,
        brothersMax,
        sistersMax: 0,
        brothersContact: { name: "C", phone: "1" },
      });

    for (let round = 0; round < 3; round++) {
      const event = await Event.findById(id);
      const registered = event.volunteers.map((v) => held.concat(waiting, extra).find((u) => u.id === v.user.toString()));
      const queued = event.waitlist.map((w) => held.concat(waiting, extra).find((u) => u.id === w.user.toString()));
      await Promise.all([
        ...registered.slice(0, 2).map((u) => cancel(u, id)),
        ...extra.slice(round * 2, round * 2 + 2).map((u) => join(u, id)),
        ...queued.slice(-1).map((u) => leave(u, id)),
        edit(event.brothersMax + 1),
      ]);
      await assertSound(id);
    }
  });

  test("raising capacity promotes as many as fit", async () => {
    const { id, waiting: [a, b, c] } = await fullEvent({ max: 1, waiters: 3 });
    const current = (await api.call(admin, "GET", `/api/events/${id}/edit`)).body;
    await api.call(admin, "PATCH", `/api/events/${id}`, {
      ...current,
      brothersMax: 3,
      brothersContact: current.brothersContact,
      sistersContact: undefined,
    });
    assert.equal((await view(a, id)).myStatus, "registered");
    assert.equal((await view(b, id)).myStatus, "registered");
    assert.equal((await view(c, id)).myWaitlistPosition, 1);
    await assertSound(id);
  });

  test("admin removal promotes; restoring past capacity promotes nobody else", async () => {
    const { id, held: [holder], waiting: [a, b] } = await fullEvent({ waiters: 2 });

    await api.call(admin, "DELETE", `/api/events/${id}/volunteers/${holder.id}`);
    assert.equal((await view(a, id)).myStatus, "registered");

    await api.call(admin, "POST", `/api/events/${id}/volunteers/${holder.id}/restore`);
    const event = await Event.findById(id);
    assert.equal(event.volunteers.length, 2, "admin override: over capacity");
    assert.equal((await view(b, id)).myWaitlistPosition, 1, "b was not promoted");
  });

  test("joining the waitlist after being removed replaces the removal, like re-registering", async () => {
    const { id, held: [holder] } = await fullEvent({ waiters: 1 });
    await api.call(admin, "DELETE", `/api/events/${id}/volunteers/${holder.id}`);
    await join(holder, id);

    const restore = await api.call(admin, "POST", `/api/events/${id}/volunteers/${holder.id}/restore`);
    assert.equal(restore.status, 404);
    assert.equal((await view(holder, id)).myWaitlistPosition, 1);
  });

  test("account deletion frees the spot and leaves the waitlist; a deleted event promotes on restore", async () => {
    const { id, held: [holder], waiting: [a] } = await fullEvent({ waiters: 1 });
    const { id: other, waiting: [b] } = await fullEvent({ waiters: 1 });
    await join(holder, other);

    await api.call(admin, "DELETE", `/api/events/${id}`);
    await api.call(holder, "DELETE", "/api/users/me");
    assert.equal((await Event.findById(id)).waitlist.length, 1, "no promotion while deleted");
    assert.equal((await Event.findById(other)).waitlist.length, 1, "holder left the other waitlist");

    await api.call(admin, "POST", `/api/events/${id}/restore`);
    assert.equal((await view(a, id)).myStatus, "registered");
    assert.equal((await view(b, other)).myWaitlistPosition, 1);
  });

  test("undo after your spot went to the waitlist is refused", async () => {
    const { id, held: [holder], waiting: [a] } = await fullEvent({ waiters: 1 });
    await cancel(holder, id);
    const res = await api.call(holder, "POST", `/api/events/${id}/register/undo`);
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "Someone took your spot, so your registration couldn't be restored");
    assert.equal((await view(a, id)).myStatus, "registered");
  });
});

describe("the 10-hour freeze", () => {
  test("inside 10 hours: waitlist hidden and cleared, no sign-ups, no promotions", async () => {
    const { id, held: [holder], waiting: [a] } = await fullEvent({ waiters: 1 });
    await Event.updateOne({ _id: id }, { date: new Date(Date.now() + 5 * HOUR) });

    const aView = await view(a, id);
    assert.equal(aView.signupsOpen, false);
    assert.equal(aView.myWaitlistPosition, null);
    assert.equal(aView.brothersWaitlisted, 0);

    const [late] = await users(1);
    assert.equal((await join(late, id)).body.message, "Sign-ups closed 10 hours before the event");
    assert.equal((await register(late, id)).body.message, "Sign-ups closed 10 hours before the event");

    // A spot frees up (admin removal): nobody is promoted, and the waitlist is emptied.
    await api.call(admin, "DELETE", `/api/events/${id}/volunteers/${holder.id}`);
    const event = await Event.findById(id);
    assert.equal(event.volunteers.length, 0);
    assert.equal(event.waitlist.length, 0);
  });

  test("moving an event into the window clears its waitlist, with a warning", async () => {
    const { id } = await fullEvent({ waiters: 2 });
    const current = (await api.call(admin, "GET", `/api/events/${id}/edit`)).body;
    const res = await api.call(admin, "PATCH", `/api/events/${id}`, {
      ...current,
      date: new Date(Date.now() + 3 * HOUR).toISOString(),
      sistersContact: undefined,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.warnings.includes("The event is now within 10 hours, so sign-ups are closed and the waitlist was cleared."));
    assert.equal((await Event.findById(id)).waitlist.length, 0);
  });

  test("a group set to 0 drops only that group's waitlist, with a warning", async () => {
    const id = await api.makeEvent(admin, { brothersMax: 1, sistersMax: 1 });
    const [s] = await users(1, "sister");
    // Sisters waiting with nobody registered can only arise mid-race; set it up directly.
    await Event.updateOne({ _id: id }, { $push: { waitlist: { user: s.id, gender: "sister" } } });
    const current = (await api.call(admin, "GET", `/api/events/${id}/edit`)).body;
    const res = await api.call(admin, "PATCH", `/api/events/${id}`, {
      ...current,
      sistersMax: 0,
      sistersContact: undefined,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.warnings.includes("1 sister was on the waitlist and was removed from it."));
    assert.equal((await Event.findById(id)).waitlist.length, 0);
  });
});

describe("privacy and admin", () => {
  test("volunteers see counts and their own position only; admins see the queue", async () => {
    const { id, waiting: [a, b] } = await fullEvent({ waiters: 2 });
    const bView = await view(b, id);
    assert.ok(!("waitlist" in bView));
    assert.equal(bView.myWaitlistPosition, 2);

    assert.equal((await api.call(b, "GET", `/api/events/${id}/waitlist`)).status, 403);
    const queue = await api.call(admin, "GET", `/api/events/${id}/waitlist`);
    assert.deepEqual(queue.body.map((w) => [w.userId, w.position]), [[a.id, 1], [b.id, 2]]);
    assert.ok("dateOfBirth" in queue.body[0]);
  });

  test("the CSV lists waitlisted people with their position", async () => {
    const { id } = await fullEvent({ waiters: 2 });
    const res = await fetch(`${api.base}/api/events/${id}/volunteers.csv`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    const text = await res.text();
    assert.match(text, /,Brother,Waitlisted #1,/);
    assert.match(text, /,Brother,Waitlisted #2,/);
  });
});
