import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startApp, startDb } from "./helpers.js";

// Everything a non-admin event response may contain.
const ALLOWED_FIELDS = new Set([
  "_id",
  "name",
  "date",
  "location",
  "hours",
  "brothersMax",
  "sistersMax",
  "deletedAt",
  "brothersRegistered",
  "sistersRegistered",
  "myStatus",
  "brothersContact",
  "sistersContact",
  "description",
  "previousDate",
  "dateChangedAt",
  "myCancelLockWaived",
  "myHours",
  "brothersWaitlisted",
  "sistersWaitlisted",
  "myWaitlistPosition",
  "myPromotedAt",
  "signupsOpen",
]);

const assertSafeEvent = (event, label) => {
  for (const key of ["volunteers", "removedVolunteers", "deletedBy"]) {
    assert.ok(!(key in event), `${label}: leaked "${key}"`);
  }
  const extra = Object.keys(event).filter((key) => !ALLOWED_FIELDS.has(key));
  assert.deepEqual(extra, [], `${label}: unexpected fields`);
};

let stopDb;
let api;
let admin;
let brother;
let sister;
let eventId;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  brother = await api.makeUser();
  sister = await api.makeUser({ gender: "sister" });
  eventId = await api.makeEvent(admin);
  await api.call(brother, "POST", `/api/events/${eventId}/register`);
});

after(async () => {
  await api.stop();
  await stopDb();
});

test("GET /events has counts and myStatus but no volunteer data", async () => {
  for (const [who, label] of [[sister, "volunteer"], [admin, "admin"]]) {
    const res = await api.call(who, "GET", "/api/events");
    assert.equal(res.status, 200);
    const event = res.body.find((e) => e._id === eventId);
    assertSafeEvent(event, `GET /events as ${label}`);
    assert.equal(event.brothersRegistered, 1);
    assert.equal(event.sistersRegistered, 0);
  }
});

test("GET /events/:id has no volunteer data", async () => {
  const res = await api.call(brother, "GET", `/api/events/${eventId}`);
  assert.equal(res.status, 200);
  assertSafeEvent(res.body, "GET /events/:id");
  assert.equal(res.body.myStatus, "registered");
});

test("register, cancel and undo responses have no volunteer data", async () => {
  const register = await api.call(sister, "POST", `/api/events/${eventId}/register`);
  assert.equal(register.status, 200);
  assertSafeEvent(register.body, "register");

  const cancel = await api.call(sister, "DELETE", `/api/events/${eventId}/register`);
  assert.equal(cancel.status, 200);
  assertSafeEvent(cancel.body, "cancel");

  const undo = await api.call(sister, "POST", `/api/events/${eventId}/register/undo`);
  assert.equal(undo.status, 200);
  assertSafeEvent(undo.body, "undo");
});

test("GET /events/deleted has no volunteer data or deletedBy", async () => {
  const doomed = await api.makeEvent(admin);
  await api.call(brother, "POST", `/api/events/${doomed}/register`);
  assert.equal((await api.call(admin, "DELETE", `/api/events/${doomed}`)).status, 200);

  const res = await api.call(admin, "GET", "/api/events/deleted");
  assert.equal(res.status, 200);
  const event = res.body.find((e) => e._id === doomed);
  assertSafeEvent(event, "GET /events/deleted");
  assert.ok(event.deletedAt);
});

test("contacts: only registered volunteers, and only their own group", async () => {
  const mine = await api.call(brother, "GET", `/api/events/${eventId}`);
  assert.deepEqual(mine.body.brothersContact, { name: "Coordinator", phone: "5555550199" });
  assert.ok(!("sistersContact" in mine.body));

  const outsider = await api.makeUser();
  const theirs = await api.call(outsider, "GET", `/api/events/${eventId}`);
  assert.ok(!("brothersContact" in theirs.body));
  assert.ok(!("sistersContact" in theirs.body));
});

test("admin volunteers endpoint still returns volunteer data; non-admins get 403", async () => {
  const res = await api.call(admin, "GET", `/api/events/${eventId}/volunteers`);
  assert.equal(res.status, 200);
  assert.ok(res.body.some((v) => v.userId === brother.id && v.status === "registered"));

  assert.equal((await api.call(brother, "GET", `/api/events/${eventId}/volunteers`)).status, 403);
});

test("user JSON never includes password or tokenVersion", async () => {
  const res = await api.call(brother, "GET", "/api/auth/me");
  assert.equal(res.status, 200);
  assert.ok(!("password" in res.body));
  assert.ok(!("tokenVersion" in res.body));
});
