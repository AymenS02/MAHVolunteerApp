import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Event from "../models/Event.js";
import { startApp, startDb } from "./helpers.js";

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

test("5 people registering at once for the last spot: exactly one gets it", async () => {
  const people = await Promise.all(Array.from({ length: 5 }, () => api.makeUser()));
  const eventId = await api.makeEvent(admin, { brothersMax: 1 });

  const results = await Promise.all(
    people.map((person) => api.call(person, "POST", `/api/events/${eventId}/register`)),
  );

  const winners = results.filter((r) => r.status === 200);
  const losers = results.filter((r) => r.status !== 200);
  assert.equal(winners.length, 1);
  for (const loser of losers) {
    assert.equal(loser.status, 400);
    assert.equal(loser.body.message, "No spots left for brothers");
  }

  const event = await Event.findById(eventId);
  assert.equal(event.volunteers.length, 1);
});

test("spot limits are per group: a full brothers side doesn't block sisters", async () => {
  const brother = await api.makeUser();
  const sister = await api.makeUser({ gender: "sister" });
  const eventId = await api.makeEvent(admin, { brothersMax: 1, sistersMax: 1 });

  assert.equal((await api.call(brother, "POST", `/api/events/${eventId}/register`)).status, 200);
  const res = await api.call(sister, "POST", `/api/events/${eventId}/register`);
  assert.equal(res.status, 200);
  assert.equal(res.body.sistersRegistered, 1);
});

test("undo-cancel racing a new registration for the last spot: exactly one wins", async () => {
  for (let round = 0; round < 5; round++) {
    const [first, second] = await Promise.all([api.makeUser(), api.makeUser()]);
    const eventId = await api.makeEvent(admin, { brothersMax: 1 });
    await api.call(first, "POST", `/api/events/${eventId}/register`);
    await api.call(first, "DELETE", `/api/events/${eventId}/register`);

    const [undo, register] = await Promise.all([
      api.call(first, "POST", `/api/events/${eventId}/register/undo`),
      api.call(second, "POST", `/api/events/${eventId}/register`),
    ]);

    const statuses = [undo.status, register.status];
    assert.equal(statuses.filter((s) => s === 200).length, 1, `round ${round}: ${statuses}`);
    if (undo.status !== 200) {
      assert.equal(undo.status, 409);
      assert.equal(undo.body.message, "Someone took your spot, so your registration couldn't be restored");
    }
    assert.equal((await Event.findById(eventId)).volunteers.length, 1);
  }
});
