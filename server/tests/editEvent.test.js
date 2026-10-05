import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { startApp, startDb } from "./helpers.js";

const HOUR = 60 * 60 * 1000;
const contact = { name: "Coordinator", phone: "5555550199" };

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

// Loads the edit form data and applies changes, like the app does.
const edit = async (eventId, changes) => {
  const current = (await api.call(admin, "GET", `/api/events/${eventId}/edit`)).body;
  const body = {
    name: current.name,
    date: current.date,
    location: current.location,
    description: current.description,
    hours: current.hours,
    brothersMax: current.brothersMax,
    sistersMax: current.sistersMax,
    ...(current.brothersContact ? { brothersContact: current.brothersContact } : {}),
    ...(current.sistersContact ? { sistersContact: current.sistersContact } : {}),
    ...changes,
  };
  return api.call(admin, "PATCH", `/api/events/${eventId}`, body);
};

const snapshot = async (eventId) =>
  (await Event.findById(eventId)).volunteers.map((v) => ({
    user: v.user.toString(),
    status: v.status,
    hoursAwarded: v.hoursAwarded,
  }));

const historyTotal = async (user) => {
  const res = await api.call(user, "GET", "/api/users/me/hours");
  const stored = (await User.findById(user.id)).volunteerHours;
  assert.equal(stored, res.body.total, "stored total = history total");
  return res.body;
};

describe("editing keeps registrations", () => {
  test("name, location and description edits keep every registration and status", async () => {
    const a = await api.makeUser();
    const b = await api.makeUser();
    const eventId = await api.makeEvent(admin, { brothersMax: 5 });
    await api.call(a, "POST", `/api/events/${eventId}/register`);
    await api.attend(admin, b, eventId);
    const before = await snapshot(eventId);
    // The event has started (to approve b); keep it there when editing.
    const startedAt = (await Event.findById(eventId)).date.toISOString();

    const res = await edit(eventId, {
      date: startedAt,
      name: "Renamed",
      location: "New hall",
      description: "Bring gloves.\nMeet at the side door.",
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.warnings, []);
    assert.deepEqual(await snapshot(eventId), before);

    const detail = await api.call(a, "GET", `/api/events/${eventId}`);
    assert.equal(detail.body.name, "Renamed");
    assert.equal(detail.body.description, "Bring gloves.\nMeet at the side door.");
    assert.equal(detail.body.myStatus, "registered");
  });

  test("an empty description is removed", async () => {
    const eventId = await api.makeEvent(admin, { description: "Old notes" });
    await edit(eventId, { description: "" });
    assert.equal((await Event.findById(eventId)).description, undefined);
  });

  test("admin only; deleted events 410; validation applies", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    const body = { name: "X", date: new Date(Date.now() + HOUR).toISOString(), location: "Y", hours: 1, brothersMax: 0, sistersMax: 0 };

    assert.equal((await api.call(v, "PATCH", `/api/events/${eventId}`, body)).status, 403);
    assert.equal((await api.call(v, "GET", `/api/events/${eventId}/edit`)).status, 403);

    const bad = await edit(eventId, { hours: 1.3 });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.message, "Hours must be in quarter hours, like 1.5 or 2.25");

    const long = await edit(eventId, { description: "x".repeat(2001) });
    assert.equal(long.body.message, "Details must be 2000 characters or fewer");

    await api.call(admin, "DELETE", `/api/events/${eventId}`);
    assert.equal((await api.call(admin, "PATCH", `/api/events/${eventId}`, body)).status, 410);
  });
});

describe("capacity", () => {
  test("lowering below registrations keeps everyone, warns, and blocks new sign-ups until there's room", async () => {
    const people = await Promise.all(Array.from({ length: 4 }, () => api.makeUser()));
    const eventId = await api.makeEvent(admin, { brothersMax: 5 });
    for (const p of people) await api.call(p, "POST", `/api/events/${eventId}/register`);

    const res = await edit(eventId, { brothersMax: 2 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.warnings, ["4 brothers registered for 2 spots. Nobody was removed."]);
    assert.equal((await Event.findById(eventId)).volunteers.length, 4);

    const late = await api.makeUser();
    const blocked = await api.call(late, "POST", `/api/events/${eventId}/register`);
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.message, "No spots left for brothers");

    await edit(eventId, { brothersMax: 5 });
    assert.equal((await api.call(late, "POST", `/api/events/${eventId}/register`)).status, 200);
  });

  test("a group can't be set to 0 while it has registrations", async () => {
    const sister = await api.makeUser({ gender: "sister" });
    const eventId = await api.makeEvent(admin, { sistersMax: 3 });
    await api.call(sister, "POST", `/api/events/${eventId}/register`);

    const res = await edit(eventId, { sistersMax: 0, sistersContact: undefined });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "1 sister is registered. Remove them before setting sisters needed to 0.");
    assert.equal((await Event.findById(eventId)).sistersContact.name, contact.name);
  });

  test("a group with no registrations can be set to 0, and its contact is removed", async () => {
    const eventId = await api.makeEvent(admin, { sistersMax: 3 });
    const res = await edit(eventId, { sistersMax: 0, sistersContact: undefined });
    assert.equal(res.status, 200);
    assert.equal((await Event.findById(eventId)).sistersContact, undefined);
  });
});

describe("date changes", () => {
  test("registrations are kept and the change is recorded", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { date: new Date(Date.now() + 48 * HOUR).toISOString() });
    await api.call(v, "POST", `/api/events/${eventId}/register`);
    const oldDate = (await Event.findById(eventId)).date;

    const res = await edit(eventId, { date: new Date(Date.now() + 72 * HOUR).toISOString() });
    assert.equal(res.status, 200);

    const detail = (await api.call(v, "GET", `/api/events/${eventId}`)).body;
    assert.equal(detail.myStatus, "registered");
    assert.equal(detail.previousDate, oldDate.toISOString());
    assert.ok(detail.dateChangedAt);
  });

  test("people registered before the change can cancel inside the 10-hour lock; people registered after can't", async () => {
    const early = await api.makeUser();
    const late = await api.makeUser();
    const eventId = await api.makeEvent(admin, { date: new Date(Date.now() + 48 * HOUR).toISOString() });
    await api.call(early, "POST", `/api/events/${eventId}/register`);

    // Moved to 5 hours from now: inside the lock.
    await edit(eventId, { date: new Date(Date.now() + 5 * HOUR).toISOString() });
    await api.call(late, "POST", `/api/events/${eventId}/register`);

    const earlyView = (await api.call(early, "GET", `/api/events/${eventId}`)).body;
    assert.equal(earlyView.myCancelLockWaived, true);
    const lateView = (await api.call(late, "GET", `/api/events/${eventId}`)).body;
    assert.equal(lateView.myCancelLockWaived, false);

    const lateCancel = await api.call(late, "DELETE", `/api/events/${eventId}/register`);
    assert.equal(lateCancel.status, 400);
    assert.equal(lateCancel.body.message, "Cancellation is locked within 10 hours of the event");

    const earlyCancel = await api.call(early, "DELETE", `/api/events/${eventId}/register`);
    assert.equal(earlyCancel.status, 200);
    assert.equal(earlyCancel.body.myStatus, null);
  });

  test("registrations from before registeredAt existed count as before the change", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { date: new Date(Date.now() + 48 * HOUR).toISOString() });
    await api.call(v, "POST", `/api/events/${eventId}/register`);
    await Event.updateOne({ _id: eventId, "volunteers.user": v.id }, { $unset: { "volunteers.$.registeredAt": "" } });
    await edit(eventId, { date: new Date(Date.now() + 5 * HOUR).toISOString() });

    assert.equal((await api.call(v, "DELETE", `/api/events/${eventId}/register`)).status, 200);
  });

  test("an event with approved hours can't move into the future, but can move within the past", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    await api.attend(admin, v, eventId);

    const future = await edit(eventId, { date: new Date(Date.now() + 24 * HOUR).toISOString() });
    assert.equal(future.status, 409);
    assert.equal(future.body.message, "Hours are already approved for this event, so it can't move to a future date");

    const past = await edit(eventId, { date: new Date(Date.now() - 24 * HOUR).toISOString() });
    assert.equal(past.status, 200);
    assert.equal((await snapshot(eventId))[0].status, "approved");
  });
});

describe("hours changes", () => {
  test("approved volunteers get the new hours and their totals follow", async () => {
    const a = await api.makeUser();
    const b = await api.makeUser();
    const pending = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 2, brothersMax: 5 });
    for (const user of [pending, a, b]) {
      await api.call(user, "POST", `/api/events/${eventId}/register`);
    }
    await api.startEvent(eventId);
    for (const user of [a, b]) {
      await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${user.id}/approve`);
    }

    const res = await edit(eventId, { hours: 3 });
    assert.equal(res.status, 200);
    assert.equal(res.body.hoursUpdatedFor, 2);

    for (const user of [a, b]) {
      const history = await historyTotal(user);
      assert.equal(history.total, 3);
    }
    const entries = await snapshot(eventId);
    assert.equal(entries.find((e) => e.user === pending.id).hoursAwarded, undefined);

    // Lowering works the same way.
    await edit(eventId, { hours: 1.5 });
    assert.equal((await historyTotal(a)).total, 1.5);
  });

  test("a partial-hour change is replaced by the new event hours, and history still adds up", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 3 });
    await api.attend(admin, v, eventId);
    await api.call(admin, "POST", `/api/users/${v.id}/hour-adjustments`, {
      amount: -1.5,
      reason: "Left early",
      eventId,
    });
    assert.equal((await historyTotal(v)).total, 1.5);

    await edit(eventId, { hours: 4 });
    const history = await historyTotal(v);
    assert.equal(history.total, 4);
    assert.deepEqual(history.items[0].adjustments, [], "old note no longer explains the hours");
  });

  test("new approvals after the edit use the new hours", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 2 });
    await api.call(v, "POST", `/api/events/${eventId}/register`);
    await edit(eventId, { hours: 2.5 });
    await api.startEvent(eventId);
    await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${v.id}/approve`);
    assert.equal((await historyTotal(v)).total, 2.5);
  });
});

describe("races", () => {
  test("registrations arriving during an edit are never lost", async () => {
    const people = await Promise.all(Array.from({ length: 5 }, () => api.makeUser()));
    const eventId = await api.makeEvent(admin, { brothersMax: 10 });

    const [editRes, ...registrations] = await Promise.all([
      edit(eventId, { name: "Edited during sign-ups", description: "Busy" }),
      ...people.map((p) => api.call(p, "POST", `/api/events/${eventId}/register`)),
    ]);

    assert.equal(editRes.status, 200, JSON.stringify(editRes.body));
    const succeeded = registrations.filter((r) => r.status === 200).length;
    const event = await Event.findById(eventId);
    assert.equal(succeeded, 5);
    assert.equal(event.volunteers.length, 5);
    assert.equal(event.name, "Edited during sign-ups");
  });
});

describe("small date differences", () => {
  test("dropping seconds from the same minute isn't a date change", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { date: new Date(Date.now() + 48 * HOUR + 37 * 1000).toISOString() });
    await api.call(v, "POST", `/api/events/${eventId}/register`);

    const sameMinute = new Date((await Event.findById(eventId)).date);
    sameMinute.setSeconds(0, 0);
    await edit(eventId, { date: sameMinute.toISOString() });

    const detail = (await api.call(v, "GET", `/api/events/${eventId}`)).body;
    assert.equal(detail.previousDate, null);
    assert.equal(detail.dateChangedAt, null);
  });
});
