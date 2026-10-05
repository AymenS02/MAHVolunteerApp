import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import Event from "../models/Event.js";
import EventMessage from "../models/EventMessage.js";
import NotificationLog from "../models/NotificationLog.js";
import PushTicket from "../models/PushTicket.js";
import PushToken from "../models/PushToken.js";
import {
  processOutbox,
  sendCancelNudges,
  sendReminders,
} from "../services/notifications.js";
import { checkReceipts, setPushTransport, settlePush } from "../services/push.js";
import { startApp, startDb } from "./helpers.js";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

let stopDb;
let api;
let admin;

// A fake Expo: records every message and answers with ok tickets, unless a
// token is listed in `deadTokens`.
let sent = [];
let deadTokens = new Set();
let receipts = {};
let ticketCount = 0;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  setPushTransport({
    async send(messages) {
      sent.push(...messages);
      return messages.map((m) =>
        deadTokens.has(m.to)
          ? { status: "error", details: { error: "DeviceNotRegistered" } }
          : { status: "ok", id: `ticket-${++ticketCount}` },
      );
    },
    async receipts() {
      return receipts;
    },
  });
});

beforeEach(() => {
  sent = [];
  deadTokens = new Set();
  receipts = {};
});

afterEach(() => settlePush());

after(async () => {
  setPushTransport(null);
  await api.stop();
  await stopDb();
});

const tokenOf = (user) => `ExponentPushToken[${user.id}]`;
const device = async (user) => {
  const res = await api.call(user, "POST", "/api/users/me/push-tokens", {
    token: tokenOf(user),
    platform: "ios",
  });
  assert.equal(res.status, 200);
  return user;
};
const volunteer = async (gender) => device(await api.makeUser({ gender }));
const inbox = async (user) => {
  await settlePush();
  return sent.filter((m) => m.to === tokenOf(user));
};

// An event `inHours` from now with these volunteers registered (registered
// while it was 48 hours away, then moved there directly).
const eventWith = async (people, { inHours = 48, ...overrides } = {}) => {
  const id = await api.makeEvent(admin, { brothersMax: 5, sistersMax: 5, ...overrides });
  for (const p of people) await api.call(p, "POST", `/api/events/${id}/register`);
  await Event.updateOne({ _id: id }, { date: new Date(Date.now() + inHours * HOUR) });
  return id;
};

const editEvent = async (id, changes) => {
  const current = (await api.call(admin, "GET", `/api/events/${id}/edit`)).body;
  return api.call(admin, "PATCH", `/api/events/${id}`, {
    ...current,
    brothersContact: current.brothersContact ?? undefined,
    sistersContact: current.sistersContact ?? undefined,
    ...changes,
  });
};

const later = (ms) => new Date(Date.now() + ms);

describe("device tokens and the on/off switch", () => {
  test("register, move between accounts on the same phone, and remove on logout", async () => {
    const a = await api.makeUser();
    const b = await api.makeUser();
    const token = "ExponentPushToken[shared-phone]";

    await api.call(a, "POST", "/api/users/me/push-tokens", { token });
    await api.call(b, "POST", "/api/users/me/push-tokens", { token });
    const record = await PushToken.findOne({ token });
    assert.equal(record.user.toString(), b.id, "the phone now belongs to b");

    // a can't remove b's device; b can.
    await api.call(a, "DELETE", `/api/users/me/push-tokens/${encodeURIComponent(token)}`);
    assert.ok(await PushToken.exists({ token }));
    await api.call(b, "DELETE", `/api/users/me/push-tokens/${encodeURIComponent(token)}`);
    assert.equal(await PushToken.exists({ token }), null);
  });

  test("invalid tokens and unauthenticated calls are refused", async () => {
    const u = await api.makeUser();
    const bad = await api.call(u, "POST", "/api/users/me/push-tokens", { token: "not-a-token" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.message, "Not a valid Expo push token");
    const anon = await api.call(null, "POST", "/api/users/me/push-tokens", { token: "ExponentPushToken[x]" });
    assert.equal(anon.status, 401);
  });

  test("account deletion and password changes remove devices", async () => {
    const gone = await volunteer();
    await api.call(gone, "DELETE", "/api/users/me");
    assert.equal(await PushToken.exists({ token: tokenOf(gone) }), null);

    const changer = await volunteer();
    await api.call(changer, "PUT", "/api/users/me/password", {
      currentPassword: changer.password,
      newPassword: "Newpass1",
    });
    assert.equal(await PushToken.exists({ token: tokenOf(changer) }), null);
  });

  test("turning notifications off stops every push", async () => {
    const v = await volunteer();
    const res = await api.call(v, "PATCH", "/api/users/me/notifications", { enabled: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.notificationsEnabled, false);

    const id = await eventWith([v]);
    await api.startEvent(id);
    await api.call(admin, "PATCH", `/api/events/${id}/volunteers/${v.id}/approve`);
    assert.deepEqual(await inbox(v), []);

    assert.equal((await api.call(v, "PATCH", "/api/users/me/notifications", { enabled: "no" })).status, 400);
  });
});

describe("sent right away", () => {
  test("approval: hours added, linking to the event", async () => {
    const v = await volunteer();
    const id = await eventWith([v], { name: "Food drive", hours: 3 });
    await api.startEvent(id);
    await api.call(admin, "PATCH", `/api/events/${id}/volunteers/${v.id}/approve`);

    const [message] = await inbox(v);
    assert.equal(message.title, "Hours approved");
    assert.equal(message.body, "+3 hrs for Food drive.");
    assert.deepEqual(message.data, { url: `/events/${id}` });
  });

  test("hours adjustment, with the reason", async () => {
    const v = await volunteer();
    await api.call(admin, "POST", `/api/users/${v.id}/hour-adjustments`, { amount: 1.5, reason: "Stayed late" });
    const [message] = await inbox(v);
    assert.equal(message.title, "Your hours were adjusted");
    assert.equal(message.body, "+1.5 hrs · Stayed late");
  });

  test("promotion from the waitlist", async () => {
    const holder = await volunteer();
    const waiter = await volunteer();
    const id = await api.makeEvent(admin, { name: "Iftar", brothersMax: 1 });
    await api.call(holder, "POST", `/api/events/${id}/register`);
    await api.call(waiter, "POST", `/api/events/${id}/waitlist`);
    await api.call(holder, "DELETE", `/api/events/${id}/register`);

    const [message] = await inbox(waiter);
    assert.equal(message.title, "You got a spot!");
  });

  test("a dead device reported on send is removed immediately; tickets are kept for receipts", async () => {
    const v = await volunteer();
    const w = await volunteer();
    deadTokens.add(tokenOf(v));
    await api.call(admin, "POST", `/api/users/${v.id}/hour-adjustments`, { amount: 1, reason: "Extra" });
    await api.call(admin, "POST", `/api/users/${w.id}/hour-adjustments`, { amount: 1, reason: "Extra" });
    await settlePush();

    assert.equal(await PushToken.exists({ token: tokenOf(v) }), null);
    assert.ok(await PushTicket.exists({ token: tokenOf(w) }));
  });
});

describe("reminders and cancel nudges", () => {
  test("a reminder about a day before, once, even when jobs run in parallel", async () => {
    const a = await volunteer();
    const b = await volunteer();
    const id = await eventWith([a, b], { inHours: 20, name: "Park cleanup" });

    await Promise.all([sendReminders(), sendReminders(), sendReminders()]);
    await sendReminders();

    const messages = await inbox(a);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].title, "Reminder: Park cleanup");
    assert.equal((await inbox(b)).length, 1);
    assert.equal(await NotificationLog.countDocuments({ event: id, kind: "reminder" }), 2);
  });

  test("too early or too late: no reminder; a moved event gets a new one", async () => {
    const v = await volunteer();
    const far = await eventWith([v], { inHours: 30 });
    const near = await eventWith([v], { inHours: 11 });
    await sendReminders();
    assert.deepEqual(await inbox(v), []);

    await Event.updateOne({ _id: far }, { date: new Date(Date.now() + 20 * HOUR) });
    await sendReminders();
    await Event.updateOne({ _id: far }, { date: new Date(Date.now() + 22 * HOUR) });
    await sendReminders();
    assert.equal((await inbox(v)).length, 2, "one reminder per date");
    assert.ok(near);
  });

  test("the cancel nudge goes to registered people 10–12 hours out, not approved ones", async () => {
    const registered = await volunteer();
    const approved = await volunteer();
    const id = await eventWith([registered, approved], { inHours: 11 });
    await Event.updateOne(
      { _id: id, "volunteers.user": approved.id },
      { $set: { "volunteers.$.status": "approved" } },
    );

    await sendCancelNudges();
    await sendCancelNudges();
    const [nudge, ...rest] = await inbox(registered);
    assert.equal(nudge.title.startsWith("Still coming to"), true);
    assert.deepEqual(rest, []);
    assert.deepEqual(await inbox(approved), []);
  });
});

describe("edits and deletions (outbox)", () => {
  test("a date change is announced after the delay, to registered and waitlisted people", async () => {
    const reg = await volunteer();
    const waiter = await volunteer();
    const id = await eventWith([reg], { brothersMax: 1, name: "Eid setup" });
    await api.call(waiter, "POST", `/api/events/${id}/waitlist`);

    await editEvent(id, { date: later(72 * HOUR).toISOString() });
    await processOutbox();
    assert.deepEqual(await inbox(reg), [], "nothing before the delay");

    await processOutbox(later(3 * MIN));
    const [message] = await inbox(reg);
    assert.equal(message.title, "Eid setup changed");
    assert.match(message.body, /^New time: /);
    assert.equal((await inbox(waiter)).length, 1);
  });

  test("several quick edits send one message; changing it back sends none", async () => {
    const v = await volunteer();
    const id = await eventWith([v]);

    await editEvent(id, { location: "Hall B" });
    await editEvent(id, { location: "Hall C", date: later(50 * HOUR).toISOString() });
    await processOutbox(later(3 * MIN));
    const messages = await inbox(v);
    assert.equal(messages.length, 1);
    assert.match(messages[0].body, /New location: Hall C\./);

    sent = [];
    const original = (await Event.findById(id)).location;
    await editEvent(id, { location: "Somewhere else" });
    await editEvent(id, { location: original });
    await processOutbox(later(3 * MIN));
    assert.deepEqual(await inbox(v), []);
  });

  test("name or description edits don't notify anyone", async () => {
    const v = await volunteer();
    const id = await eventWith([v]);
    await editEvent(id, { name: "Renamed", description: "New notes" });
    await processOutbox(later(3 * MIN));
    assert.deepEqual(await inbox(v), []);
  });

  test("an hours change tells approved volunteers their new hours", async () => {
    const v = await volunteer();
    const id = await eventWith([v], { hours: 2 });
    await api.startEvent(id);
    await api.call(admin, "PATCH", `/api/events/${id}/volunteers/${v.id}/approve`);
    await settlePush();
    sent = [];

    await editEvent(id, { hours: 3 });
    await processOutbox(later(3 * MIN));
    const [message] = await inbox(v);
    assert.equal(message.title, "Hours updated");
    assert.match(message.body, /now 3 hrs/);
  });

  test("delete then Undo within 2 minutes: nothing is sent", async () => {
    const v = await volunteer();
    const id = await eventWith([v]);
    await api.call(admin, "DELETE", `/api/events/${id}`);
    await api.call(admin, "POST", `/api/events/${id}/restore`);
    await processOutbox(later(3 * MIN));
    assert.deepEqual(await inbox(v), []);
  });

  test("deleted for real: 'cancelled'; restored later: 'back on' to the same people only", async () => {
    const v = await volunteer();
    const id = await eventWith([v], { name: "Bake sale" });
    await api.call(admin, "DELETE", `/api/events/${id}`);
    await processOutbox(later(3 * MIN));
    let [message] = await inbox(v);
    assert.equal(message.title, "Bake sale was cancelled");

    // Someone who signs up after the restore isn't told "back on".
    sent = [];
    await api.call(admin, "POST", `/api/events/${id}/restore`);
    const newcomer = await volunteer();
    await api.call(newcomer, "POST", `/api/events/${id}/register`);
    await processOutbox(later(3 * MIN));
    [message] = await inbox(v);
    assert.equal(message.title, "Bake sale is back on");
    assert.deepEqual(await inbox(newcomer), []);
  });
});

describe("admin messages", () => {
  test("go to registered and approved volunteers; the waitlist only when included", async () => {
    const a = await volunteer();
    const b = await volunteer();
    const waiter = await volunteer();
    const id = await eventWith([a, b], { brothersMax: 2, name: "Clothing drive" });
    await api.call(waiter, "POST", `/api/events/${id}/waitlist`);

    let res = await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "Park at the back." });
    assert.equal(res.status, 201);
    assert.equal(res.body.recipientCount, 2);
    assert.equal((await inbox(a))[0].body, "Park at the back.");
    assert.equal((await inbox(a))[0].title, "Message about Clothing drive");
    assert.deepEqual(await inbox(waiter), []);

    res = await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "Waitlist: we may need you.", includeWaitlist: true });
    assert.equal(res.body.recipientCount, 3);
    assert.equal((await inbox(waiter)).length, 1);
  });

  test("admins only, validated, and limited to 5 per event per day", async () => {
    const v = await volunteer();
    const id = await eventWith([v]);
    assert.equal((await api.call(v, "POST", `/api/events/${id}/messages`, { body: "Hi" })).status, 403);
    const empty = await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "  " });
    assert.equal(empty.body.message, "Write a message");

    for (let i = 0; i < 5; i++) {
      assert.equal((await api.call(admin, "POST", `/api/events/${id}/messages`, { body: `Update ${i}` })).status, 201);
    }
    const sixth = await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "One more" });
    assert.equal(sixth.status, 429);
    assert.equal(sixth.body.message, "You can send up to 5 messages per event per day");
  });

  test("shown in the app to the right people, even with notifications off", async () => {
    const reg = await volunteer();
    const waiter = await volunteer();
    const outsider = await volunteer();
    const id = await eventWith([reg], { brothersMax: 1 });
    await api.call(waiter, "POST", `/api/events/${id}/waitlist`);
    await api.call(reg, "PATCH", "/api/users/me/notifications", { enabled: false });

    await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "Only for signed-up" });
    await api.call(admin, "POST", `/api/events/${id}/messages`, { body: "Everyone", includeWaitlist: true });
    assert.deepEqual(await inbox(reg), [], "no push when switched off");

    const regView = await api.call(reg, "GET", `/api/events/${id}/messages`);
    assert.deepEqual(regView.body.map((m) => m.body), ["Everyone", "Only for signed-up"]);
    assert.ok(!("sentBy" in regView.body[0]));

    const waiterView = await api.call(waiter, "GET", `/api/events/${id}/messages`);
    assert.deepEqual(waiterView.body.map((m) => m.body), ["Everyone"]);

    assert.equal((await api.call(outsider, "GET", `/api/events/${id}/messages`)).status, 403);

    const adminView = await api.call(admin, "GET", `/api/events/${id}/messages`);
    assert.equal(adminView.body[0].recipientCount, 2);
    assert.equal(adminView.body[0].sentBy, "Test User 1");
    assert.equal(await EventMessage.countDocuments({ event: id }), 2);
  });
});

describe("delivery receipts", () => {
  test("15 minutes later, devices reported as uninstalled are removed", async () => {
    const v = await volunteer();
    const w = await volunteer();
    await api.call(admin, "POST", `/api/users/${v.id}/hour-adjustments`, { amount: 1, reason: "Extra" });
    await api.call(admin, "POST", `/api/users/${w.id}/hour-adjustments`, { amount: 1, reason: "Extra" });
    await settlePush();

    const vTicket = await PushTicket.findOne({ token: tokenOf(v) });
    const wTicket = await PushTicket.findOne({ token: tokenOf(w) });

    // Not due yet.
    assert.equal((await checkReceipts()).checked, 0);

    receipts = {
      [vTicket.ticketId]: { status: "error", details: { error: "DeviceNotRegistered" } },
      [wTicket.ticketId]: { status: "ok" },
    };
    const result = await checkReceipts(later(16 * MIN));
    assert.equal(result.removed, 1);
    assert.equal(await PushToken.exists({ token: tokenOf(v) }), null);
    assert.ok(await PushToken.exists({ token: tokenOf(w) }));
    assert.equal(await PushTicket.exists({ ticketId: wTicket.ticketId }), null, "checked tickets are cleared");
  });
});
