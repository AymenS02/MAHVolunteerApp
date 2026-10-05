import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Event from "../models/Event.js";
import { startApp, startDb } from "./helpers.js";

const HOUR = 60 * 60 * 1000;

let stopDb;
let api;
let admin;
let volunteer;
const upcomingIds = [];
const pastIds = [];

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  volunteer = await api.makeUser();

  // 7 upcoming (two share a date, to exercise the id tie-break) and 5 past.
  const sameTime = new Date(Date.now() + 50 * HOUR).toISOString();
  for (let i = 0; i < 7; i++) {
    const date = i === 3 || i === 4 ? sameTime : new Date(Date.now() + (i + 1) * 24 * HOUR).toISOString();
    upcomingIds.push(await api.makeEvent(admin, { name: `Up ${i}`, date }));
  }
  for (let i = 0; i < 5; i++) {
    const id = await api.makeEvent(admin, { name: `Past ${i}` });
    await Event.updateOne({ _id: id }, { date: new Date(Date.now() - (i + 1) * 24 * HOUR) });
    pastIds.push(id);
  }
  const deleted = await api.makeEvent(admin, { name: "Deleted" });
  await api.call(admin, "DELETE", `/api/events/${deleted}`);
});

after(async () => {
  await api.stop();
  await stopDb();
});

const readAll = async (when, limit) => {
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const query = `when=${when}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`;
    const res = await api.call(volunteer, "GET", `/api/events?${query}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length <= limit);
    seen.push(...res.body.items);
    cursor = res.body.nextCursor;
    pages++;
  } while (cursor && pages < 20);
  return seen;
};

test("upcoming pages: soonest first, every event once, deleted excluded, correct total", async () => {
  const first = await api.call(volunteer, "GET", "/api/events?when=upcoming&limit=3");
  assert.equal(first.body.total, 7);
  assert.ok(first.body.nextCursor);

  const all = await readAll("upcoming", 3);
  assert.equal(all.length, 7);
  assert.equal(new Set(all.map((e) => e._id)).size, 7, "no duplicates");
  assert.deepEqual(new Set(all.map((e) => e._id)), new Set(upcomingIds));
  const times = all.map((e) => new Date(e.date).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.ok(!all.some((e) => e.name === "Deleted"));
});

test("past pages: most recent first", async () => {
  const all = await readAll("past", 2);
  assert.deepEqual(all.map((e) => e.name), ["Past 0", "Past 1", "Past 2", "Past 3", "Past 4"]);
});

test("an event added between pages causes no duplicates or gaps in what was already paged", async () => {
  const page1 = await api.call(volunteer, "GET", "/api/events?when=upcoming&limit=3");
  // Lands before the cursor, so it belongs to page 1 territory; later pages must not repeat page 1.
  const extra = await api.makeEvent(admin, { name: "Added later", date: new Date(Date.now() + 2 * HOUR).toISOString() });
  let cursor = page1.body.nextCursor;
  const rest = [];
  while (cursor) {
    const res = await api.call(volunteer, "GET", `/api/events?when=upcoming&limit=3&cursor=${cursor}`);
    rest.push(...res.body.items);
    cursor = res.body.nextCursor;
  }
  const ids = [...page1.body.items, ...rest].map((e) => e._id);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.deepEqual(new Set(ids), new Set(upcomingIds), "nothing skipped");
  await Event.deleteOne({ _id: extra });
});

test("paged items have the same shape as before (no volunteer data)", async () => {
  const res = await api.call(volunteer, "GET", "/api/events?when=upcoming&limit=1");
  const [item] = res.body.items;
  assert.ok(!("volunteers" in item));
  assert.equal(item.myStatus, null);
  assert.equal(typeof item.brothersRegistered, "number");
});

test("bad parameters get a 400", async () => {
  for (const query of ["when=later", "when=upcoming&limit=0", "when=upcoming&limit=51", "when=upcoming&cursor=garbage"]) {
    const res = await api.call(volunteer, "GET", `/api/events?${query}`);
    assert.equal(res.status, 400, query);
  }
});

test("without ?when= the old full array is returned unchanged", async () => {
  const res = await api.call(volunteer, "GET", "/api/events");
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 12);
});
