import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Event from "../models/Event.js";
import HourAdjustment from "../models/HourAdjustment.js";
import NotificationLog from "../models/NotificationLog.js";
import PushToken from "../models/PushToken.js";
import User from "../models/User.js";
import { sendReminders } from "../services/notifications.js";
import { setPushTransport, settlePush } from "../services/push.js";
import { startApp, startDb } from "./helpers.js";

const HOUR = 60 * 60 * 1000;

let stopDb;
let api;
let admin;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  // Nothing leaves the test.
  setPushTransport({
    send: async (messages) => messages.map((_, i) => ({ status: "ok", id: `t-${Date.now()}-${i}` })),
    receipts: async () => ({}),
  });
});

after(async () => {
  setPushTransport(null);
  await settlePush();
  await api.stop();
  await stopDb();
});

test("deleting an account removes every record about that person, and only theirs", async () => {
  const leaving = await api.makeUser();
  const staying = await api.makeUser();
  const people = [leaving, staying];

  // Give both people the full set of records: registrations, a waitlist
  // spot, approved hours, an adjustment, a device and a sent reminder.
  const attended = await api.makeEvent(admin, { brothersMax: 5 });
  for (const p of people) await api.call(p, "POST", `/api/events/${attended}/register`);
  await api.startEvent(attended);
  for (const p of people) {
    await api.call(admin, "PATCH", `/api/events/${attended}/volunteers/${p.id}/approve`);
    await api.call(admin, "POST", `/api/users/${p.id}/hour-adjustments`, { amount: 1, reason: "Stayed late" });
    await api.call(p, "POST", "/api/users/me/push-tokens", { token: `ExponentPushToken[${p.id}]` });
  }

  const upcoming = await api.makeEvent(admin, { brothersMax: 5 });
  for (const p of people) await api.call(p, "POST", `/api/events/${upcoming}/register`);
  await Event.updateOne({ _id: upcoming }, { date: new Date(Date.now() + 20 * HOUR) });
  await sendReminders();

  const full = await api.makeEvent(admin, { brothersMax: 1 });
  const holder = await api.makeUser();
  await api.call(holder, "POST", `/api/events/${full}/register`);
  for (const p of people) await api.call(p, "POST", `/api/events/${full}/waitlist`);
  await settlePush();

  const recordsOf = async (p) => ({
    user: await User.countDocuments({ _id: p.id }),
    adjustments: await HourAdjustment.countDocuments({ user: p.id }),
    notificationLogs: await NotificationLog.countDocuments({ user: p.id }),
    devices: await PushToken.countDocuments({ user: p.id }),
    events: await Event.countDocuments({
      $or: [{ "volunteers.user": p.id }, { "removedVolunteers.user": p.id }, { "waitlist.user": p.id }],
    }),
  });

  const everything = { user: 1, adjustments: 1, notificationLogs: 1, devices: 1, events: 3 };
  assert.deepEqual(await recordsOf(leaving), everything, "setup gave them every kind of record");

  const res = await api.call(leaving, "DELETE", "/api/users/me");
  assert.equal(res.status, 200);

  assert.deepEqual(await recordsOf(leaving), {
    user: 0,
    adjustments: 0,
    notificationLogs: 0,
    devices: 0,
    events: 0,
  });
  assert.deepEqual(await recordsOf(staying), everything, "nobody else's records were touched");
});
