import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Event from "../models/Event.js";
import { startApp, startDb } from "./helpers.js";

let stopDb;
let api;
let admin;
let reviewer;
let volunteer;
let sampleId;
let fullSampleId;
let publicId;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
  admin = await api.makeUser({ admin: true });
  reviewer = await api.makeUser();
  volunteer = await api.makeUser();

  publicId = await api.makeEvent(admin, { name: "Real event" });
  sampleId = await api.makeEvent(admin, { name: "Sample event" });
  fullSampleId = await api.makeEvent(admin, { name: "Full sample", brothersMax: 1 });
  await Event.updateMany(
    { _id: { $in: [sampleId, fullSampleId] } },
    { $set: { visibleTo: [reviewer.id] } },
  );
  // Fill the full sample's one brother spot.
  const filler = await api.makeUser();
  await Event.updateOne(
    { _id: fullSampleId },
    { $push: { volunteers: { user: filler.id, gender: "brother", status: "registered" } } },
  );
});

after(async () => {
  await api.stop();
  await stopDb();
});

const namesIn = (list) => list.map((e) => e.name).sort();

describe("hidden from everyone else", () => {
  test("not in either list", async () => {
    const all = await api.call(volunteer, "GET", "/api/events");
    assert.deepEqual(namesIn(all.body), ["Real event"]);
    const page = await api.call(volunteer, "GET", "/api/events?when=upcoming&limit=10");
    assert.deepEqual(namesIn(page.body.items), ["Real event"]);
    assert.equal(page.body.total, 1, "counts exclude hidden events too");
  });

  test("detail, register, undo and waitlist all answer 'Event not found'", async () => {
    const attempts = [
      ["GET", `/api/events/${sampleId}`],
      ["POST", `/api/events/${sampleId}/register`],
      ["POST", `/api/events/${sampleId}/register/undo`],
      ["POST", `/api/events/${fullSampleId}/waitlist`],
    ];
    for (const [method, url] of attempts) {
      const res = await api.call(volunteer, method, url);
      assert.equal(res.status, 404, `${method} ${url}`);
      assert.equal(res.body.message, "Event not found");
    }
    assert.equal((await Event.findById(sampleId)).volunteers.length, 0);
  });
});

describe("the listed account", () => {
  test("sees them and can register, cancel and join the waitlist", async () => {
    const all = await api.call(reviewer, "GET", "/api/events");
    assert.deepEqual(namesIn(all.body), ["Full sample", "Real event", "Sample event"]);

    let res = await api.call(reviewer, "POST", `/api/events/${sampleId}/register`);
    assert.equal(res.body.myStatus, "registered");
    res = await api.call(reviewer, "DELETE", `/api/events/${sampleId}/register`);
    assert.equal(res.body.myStatus, null);
    res = await api.call(reviewer, "POST", `/api/events/${sampleId}/register/undo`);
    assert.equal(res.body.myStatus, "registered");

    res = await api.call(reviewer, "POST", `/api/events/${fullSampleId}/waitlist`);
    assert.equal(res.body.myWaitlistPosition, 1);
  });
});

test("admins see every event, hidden or not", async () => {
  const all = await api.call(admin, "GET", "/api/events");
  assert.deepEqual(namesIn(all.body), ["Full sample", "Real event", "Sample event"]);
  assert.ok(publicId);
});
