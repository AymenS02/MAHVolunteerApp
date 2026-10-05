import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Event from "../models/Event.js";
import HourAdjustment from "../models/HourAdjustment.js";
import User from "../models/User.js";
import { startApp, startDb } from "./helpers.js";

let stopDb;
let api;
let admin;
let admin2;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  admin2 = await api.makeUser({ admin: true });
});

after(async () => {
  await api.stop();
  await stopDb();
});

const sum = (values) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
const itemHours = (item) => (item.type === "event" ? item.hours : item.amount);

// The history total, the sum of its items and the stored total all agree.
const assertConsistent = async (user, expected) => {
  const res = await api.call(user, "GET", "/api/users/me/hours");
  assert.equal(res.status, 200);
  const stored = (await User.findById(user.id)).volunteerHours;
  assert.equal(res.body.total, sum(res.body.items.map(itemHours)), "total = sum of items");
  assert.equal(stored, res.body.total, "stored volunteerHours = history total");
  if (expected !== undefined) assert.equal(res.body.total, expected);
  return res.body;
};

const adjust = (who, user, body) =>
  api.call(who, "POST", `/api/users/${user.id}/hour-adjustments`, body);

describe("hours total", () => {
  test("hours can't be approved before the event starts", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    await api.call(v, "POST", `/api/events/${eventId}/register`);

    const res = await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${v.id}/approve`);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Hours can only be approved once the event has started");
    await assertConsistent(v, 0);
  });

  test("history lists approved events only, and the total equals their sum", async () => {
    const v = await api.makeUser();
    const a = await api.makeEvent(admin, { name: "Food drive", hours: 3 });
    const b = await api.makeEvent(admin, { name: "Iftar setup", hours: 1.5 });
    const registeredOnly = await api.makeEvent(admin, { name: "Registered only" });
    const unapproved = await api.makeEvent(admin, { name: "Unapproved" });
    const removed = await api.makeEvent(admin, { name: "Removed" });

    await api.attend(admin, v, a);
    await api.attend(admin, v, b);
    await api.call(v, "POST", `/api/events/${registeredOnly}/register`);
    await api.attend(admin, v, unapproved);
    await api.call(admin, "PATCH", `/api/events/${unapproved}/volunteers/${v.id}/unapprove`);
    await api.attend(admin, v, removed);
    await api.call(admin, "DELETE", `/api/events/${removed}/volunteers/${v.id}`);

    const history = await assertConsistent(v, 4.5);
    assert.deepEqual(history.items.map((i) => i.name).sort(), ["Food drive", "Iftar setup"]);

    // Restoring the removed approval brings its hours back into both.
    await api.call(admin, "POST", `/api/events/${removed}/volunteers/${v.id}/restore`);
    await assertConsistent(v, 7.5);
  });

  test("approvals record who approved and when; unapprove clears it", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    await api.attend(admin, v, eventId);

    let entry = (await Event.findById(eventId)).volunteers[0];
    assert.ok(entry.approvedBy.equals(admin.id));
    assert.ok(entry.approvedAt instanceof Date);

    await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${v.id}/unapprove`);
    entry = (await Event.findById(eventId)).volunteers[0];
    assert.equal(entry.approvedBy, undefined);
    assert.equal(entry.approvedAt, undefined);
  });

  test("older approvals without hoursAwarded count the event's hours", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 2 });
    await api.attend(admin, v, eventId);
    await Event.updateOne(
      { _id: eventId, "volunteers.user": v.id },
      { $unset: { "volunteers.$.hoursAwarded": "" } },
    );
    await assertConsistent(v, 2);
  });

  test("new events must use quarter hours", async () => {
    const res = await api.call(admin, "POST", "/api/events", {
      name: "Odd hours",
      date: new Date(Date.now() + 86400000).toISOString(),
      location: "Hall",
      hours: 1.3,
      brothersMax: 1,
      sistersMax: 0,
      brothersContact: { name: "C", phone: "1" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Hours must be in quarter hours, like 1.5 or 2.25");
  });
});

describe("adjustments", () => {
  test("only admins can adjust or read someone else's hours", async () => {
    const v = await api.makeUser();
    const other = await api.makeUser();
    const body = { amount: 1, reason: "Extra help" };

    assert.equal((await adjust(v, other, body)).status, 403);
    assert.equal((await adjust(v, v, body)).status, 403);
    assert.equal((await api.call(v, "GET", `/api/users/${other.id}/hours`)).status, 403);
    assert.equal((await adjust(null, other, body)).status, 401);
    assert.equal(await HourAdjustment.countDocuments({ user: other.id }), 0);
  });

  test("admins can't adjust their own hours", async () => {
    const res = await adjust(admin, admin, { amount: 5, reason: "Giving myself hours" });
    assert.equal(res.status, 403);
    assert.equal(res.body.message, "You can't adjust your own hours");
  });

  test("validates amount and requires a reason", async () => {
    const v = await api.makeUser();
    const cases = [
      [{ amount: 1 }, "A reason is required"],
      [{ amount: 1, reason: "ok" }, "A reason is required (at least 3 characters)"],
      [{ amount: 0, reason: "Nothing" }, "Amount can't be 0"],
      [{ amount: 0.1, reason: "Tiny" }, "Use quarter hours, like 1.5 or 0.25"],
      [{ amount: 101, reason: "Huge" }, "Adjustments can't be more than 100 hours"],
      [{ amount: 1, reason: "Extra", role: "admin" }, 'Unrecognized key: "role"'],
    ];
    for (const [body, message] of cases) {
      const res = await adjust(admin, v, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.message, message);
    }
    assert.equal(await HourAdjustment.countDocuments({ user: v.id }), 0);
  });

  test("a standalone adjustment is recorded with who, when, before and after", async () => {
    const v = await api.makeUser();
    await api.attend(admin, v, await api.makeEvent(admin, { hours: 3 }));

    const res = await adjust(admin, v, { amount: 2, reason: "Helped pack up after" });
    assert.equal(res.status, 201);
    assert.equal(res.body.adjustment.before, 3);
    assert.equal(res.body.adjustment.after, 5);

    const history = await assertConsistent(v, 5);
    const item = history.items.find((i) => i.type === "adjustment");
    assert.equal(item.amount, 2);
    assert.equal(item.reason, "Helped pack up after");

    const audit = await api.call(admin, "GET", `/api/users/${v.id}/hours`);
    assert.equal(audit.status, 200);
    const [record] = audit.body.audit;
    assert.equal(record.by, "Test User 1");
    assert.equal(record.before, 3);
    assert.equal(record.after, 5);
    assert.ok(record.date);
  });

  test("partial hours on an event change what that event counts, and survive unapprove/re-approve correctly", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { name: "Cleanup", hours: 3 });
    await api.attend(admin, v, eventId);

    const res = await adjust(admin, v, { amount: -1.5, reason: "Left early", eventId });
    assert.equal(res.status, 201);

    let history = await assertConsistent(v, 1.5);
    const item = history.items.find((i) => i.eventId === eventId);
    assert.equal(item.hours, 1.5);
    assert.equal(item.eventHours, 3);
    assert.deepEqual(item.adjustments.map((a) => [a.amount, a.reason]), [[-1.5, "Left early"]]);

    // Unapprove takes away what's counted now (1.5), not the original 3.
    await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${v.id}/unapprove`);
    await assertConsistent(v, 0);

    // Re-approving starts fresh at the event's hours; the old note no longer applies.
    await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${v.id}/approve`);
    history = await assertConsistent(v, 3);
    assert.deepEqual(history.items.find((i) => i.eventId === eventId).adjustments, []);

    // The audit trail still has it.
    const audit = await api.call(admin, "GET", `/api/users/${v.id}/hours`);
    assert.equal(audit.body.audit[0].event.name, "Cleanup");
    assert.equal(audit.body.audit[0].event.hoursBefore, 3);
    assert.equal(audit.body.audit[0].event.hoursAfter, 1.5);
  });

  test("can't push an event or the total below 0, and nothing is written", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 3 });
    await api.attend(admin, v, eventId);

    let res = await adjust(admin, v, { amount: -4, reason: "Too much", eventId });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "That would make this event's hours negative");

    res = await adjust(admin, v, { amount: -10, reason: "Too much" });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "That would make their total negative");

    assert.equal(await HourAdjustment.countDocuments({ user: v.id }), 0);
    await assertConsistent(v, 3);
  });

  test("event adjustments need an event the volunteer is approved on", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    await api.call(v, "POST", `/api/events/${eventId}/register`);

    const res = await adjust(admin, v, { amount: 1, reason: "Stayed late", eventId });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "This volunteer isn't approved for that event");
  });

  test("10 adjustments at once from two admins: exact total and an unbroken before/after chain", async () => {
    const v = await api.makeUser();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        adjust(i % 2 ? admin2 : admin, v, { amount: 0.25, reason: `Batch ${i}` }),
      ),
    );
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.body)));
    await assertConsistent(v, 2.5);

    const chain = (await HourAdjustment.find({ user: v.id })).sort((a, b) => a.before - b.before);
    chain.forEach((record, i) => {
      assert.equal(record.before, i * 0.25);
      assert.equal(record.after, (i + 1) * 0.25);
    });
  });

  test("parallel partial-hour changes on one event all apply exactly", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 3 });
    await api.attend(admin, v, eventId);

    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        adjust(i % 2 ? admin2 : admin, v, { amount: -0.25, reason: `Late ${i}`, eventId }),
      ),
    );
    const applied = results.filter((r) => r.status === 201).length;
    const history = await assertConsistent(v, 3 - 0.25 * applied);
    assert.equal(history.items[0].hours, 3 - 0.25 * applied);
    assert.equal(await HourAdjustment.countDocuments({ user: v.id }), applied);
  });

  test("there's no way to edit or delete an adjustment", async () => {
    const v = await api.makeUser();
    await adjust(admin, v, { amount: 1, reason: "Extra help" });
    const [record] = await HourAdjustment.find({ user: v.id });

    for (const method of ["PATCH", "PUT", "DELETE"]) {
      const res = await api.call(admin, method, `/api/users/${v.id}/hour-adjustments/${record._id}`, {});
      assert.equal(res.status, 404, method);
    }
    assert.equal(await HourAdjustment.countDocuments({ user: v.id }), 1);
  });
});

describe("student summary", () => {
  test("includes approved events only, with partial hours folded in", async () => {
    const v = await api.makeUser();
    const kept = await api.makeEvent(admin, { name: "Approved full", hours: 2 });
    const partial = await api.makeEvent(admin, { name: "Approved partial", hours: 3 });
    const registeredOnly = await api.makeEvent(admin, { name: "Registered only" });
    const unapproved = await api.makeEvent(admin, { name: "Unapproved" });
    const removed = await api.makeEvent(admin, { name: "Removed" });
    const deleted = await api.makeEvent(admin, { name: "Deleted" });

    await api.attend(admin, v, kept);
    await api.attend(admin, v, partial);
    await adjust(admin, v, { amount: -1, reason: "Left early", eventId: partial });
    await api.call(v, "POST", `/api/events/${registeredOnly}/register`);
    await api.attend(admin, v, unapproved);
    await api.call(admin, "PATCH", `/api/events/${unapproved}/volunteers/${v.id}/unapprove`);
    await api.attend(admin, v, removed);
    await api.call(admin, "DELETE", `/api/events/${removed}/volunteers/${v.id}`);
    await api.call(v, "POST", `/api/events/${deleted}/register`);
    await api.call(admin, "DELETE", `/api/events/${deleted}`);
    await adjust(admin, v, { amount: 5, reason: "Standalone correction" });

    const res = await api.call(v, "GET", "/api/users/me/hours/summary");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.events.map((e) => [e.name, e.hours]).sort(),
      [["Approved full", 2], ["Approved partial", 2]],
    );
    assert.equal(res.body.total, 4);
    assert.equal(res.body.volunteer.lastName, "User " + v.email.match(/\d+/)[0]);
    assert.ok(!("dateOfBirth" in res.body.volunteer));

    // The profile total also counts the standalone correction.
    await assertConsistent(v, 9);
  });

  test("is only ever your own", async () => {
    const res = await api.call(null, "GET", "/api/users/me/hours/summary");
    assert.equal(res.status, 401);
  });
});

describe("volunteers CSV", () => {
  const getCsv = (who, eventId) =>
    fetch(`${api.base}/api/events/${eventId}/volunteers.csv`, {
      headers: who ? { Authorization: `Bearer ${who.token}` } : {},
    });

  test("admins get name, group, status and an under-18 flag, safely escaped", async () => {
    const minor = await api.makeUser({ dateOfBirth: "2012-05-05" });
    const adult = await api.makeUser({ gender: "sister", dateOfBirth: "1990-01-01" });
    const legacy = await api.makeLegacyUser();
    await User.updateOne({ _id: adult.id }, { firstName: "=HYPERLINK(1)", lastName: "Smith, Jr" });

    const eventId = await api.makeEvent(admin, { name: "Eid Prayer!", brothersMax: 5, sistersMax: 5 });
    await api.call(minor, "POST", `/api/events/${eventId}/register`);
    await api.call(adult, "POST", `/api/events/${eventId}/register`);
    await api.call(legacy, "POST", `/api/events/${eventId}/register`);
    await api.startEvent(eventId);
    await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${adult.id}/approve`);

    const res = await getCsv(admin, eventId);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/csv/);
    assert.match(res.headers.get("content-disposition"), /attachment; filename="eid-prayer-\d{4}-\d{2}-\d{2}-volunteers\.csv"/);

    const text = (await res.text()).replace(/^﻿/, "");
    const lines = text.trimEnd().split("\r\n");
    assert.equal(lines[0], "First name,Last name,Group,Status,Under 18");
    assert.ok(lines.includes(`'=HYPERLINK(1),"Smith, Jr",Sister,Approved,No`), text);
    assert.ok(lines.some((l) => l.endsWith(",Brother,Registered,Yes")), text);
    assert.ok(lines.some((l) => l.startsWith("Legacy,") && l.endsWith(",Unknown")), text);
    assert.doesNotMatch(text, /2012|1990|555|@example/, "no dates of birth, phones or emails");
  });

  test("volunteers can't download it; deleted events 404", async () => {
    const v = await api.makeUser();
    const eventId = await api.makeEvent(admin);
    assert.equal((await getCsv(v, eventId)).status, 403);
    assert.equal((await getCsv(null, eventId)).status, 401);

    await api.call(admin, "DELETE", `/api/events/${eventId}`);
    assert.equal((await getCsv(admin, eventId)).status, 404);
  });
});

describe("event detail", () => {
  test("myHours shows the volunteer's own counted hours, including partial-hour changes", async () => {
    const v = await api.makeUser();
    const other = await api.makeUser();
    const eventId = await api.makeEvent(admin, { hours: 3 });
    await api.attend(admin, v, eventId);

    let detail = (await api.call(v, "GET", `/api/events/${eventId}`)).body;
    assert.equal(detail.myHours, 3);

    await adjust(admin, v, { amount: -1.5, reason: "Left early", eventId });
    detail = (await api.call(v, "GET", `/api/events/${eventId}`)).body;
    assert.equal(detail.myHours, 1.5);
    assert.equal(detail.hours, 3, "the event's own hours are unchanged");

    // Not approved (or not on the event): null.
    assert.equal((await api.call(other, "GET", `/api/events/${eventId}`)).body.myHours, null);
  });
});
