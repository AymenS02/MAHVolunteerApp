import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import User from "../models/User.js";
import { startApp, startDb } from "./helpers.js";

// "YYYY-MM-DD" for today's UTC date shifted back `years` and forward `days`.
const isoYearsAgo = (years, days = 0) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() + days),
  )
    .toISOString()
    .slice(0, 10);
};

const midnightUtc = (day) => `${day}T00:00:00.000Z`;

// Every dateOfBirth value anywhere in a JSON body.
const findDatesOfBirth = (value, found = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => findDatesOfBirth(item, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "dateOfBirth") found.push(child);
      findDatesOfBirth(child, found);
    }
  }
  return found;
};

let stopDb;
let api;

before(async () => {
  stopDb = await startDb();
  api = await startApp();
});

after(async () => {
  await api.stop();
  await stopDb();
});

describe("privacy", () => {
  test("a volunteer never receives anyone's dateOfBirth but their own", async () => {
    const admin = await api.makeUser({ admin: true, dateOfBirth: "1980-05-20" });
    const me = await api.makeUser({ dateOfBirth: "2009-03-14" });
    const other = await api.makeUser({ dateOfBirth: "2011-07-01" });
    const eventId = await api.makeEvent(admin);
    const deletedId = await api.makeEvent(admin);
    await api.call(other, "POST", `/api/events/${eventId}/register`);
    await api.call(other, "POST", `/api/events/${deletedId}/register`);
    await api.call(admin, "DELETE", `/api/events/${deletedId}`);

    const mine = midnightUtc(me.dateOfBirth);
    const responses = {
      "POST /auth/login": await api.call(null, "POST", "/api/auth/login", { email: me.email, password: me.password }),
      "GET /auth/me": await api.call(me, "GET", "/api/auth/me"),
      "GET /events": await api.call(me, "GET", "/api/events"),
      "GET /events/:id": await api.call(me, "GET", `/api/events/${eventId}`),
      "POST /events/:id/register": await api.call(me, "POST", `/api/events/${eventId}/register`),
      "DELETE /events/:id/register": await api.call(me, "DELETE", `/api/events/${eventId}/register`),
      "POST /events/:id/register/undo": await api.call(me, "POST", `/api/events/${eventId}/register/undo`),
      "GET /events/deleted": await api.call(me, "GET", "/api/events/deleted"),
      "GET /events/:id/volunteers": await api.call(me, "GET", `/api/events/${eventId}/volunteers`),
      "GET /events/:id/volunteers/removed": await api.call(me, "GET", `/api/events/${eventId}/volunteers/removed`),
      "PUT /users/me/date-of-birth": await api.call(me, "PUT", "/api/users/me/date-of-birth", { dateOfBirth: "2009-03-14" }),
    };

    for (const [label, res] of Object.entries(responses)) {
      for (const value of findDatesOfBirth(res.body)) {
        assert.equal(value, mine, `${label} leaked someone else's dateOfBirth`);
      }
    }

    // Admin endpoints refuse volunteers outright.
    for (const label of ["GET /events/deleted", "GET /events/:id/volunteers", "GET /events/:id/volunteers/removed"]) {
      assert.equal(responses[label].status, 403, label);
    }
    // And the user does get their own.
    assert.equal(responses["GET /auth/me"].body.dateOfBirth, mine);
    assert.equal(responses["POST /auth/login"].body.user.dateOfBirth, mine);
  });

  test("register returns the new user's own dateOfBirth", async () => {
    const res = await api.call(null, "POST", "/api/auth/register", {
      firstName: "New",
      lastName: "Person",
      email: "new-person@example.com",
      password: "Password1",
      phone: "5555550100",
      gender: "sister",
      dateOfBirth: "2008-03-14",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.dateOfBirth, "2008-03-14T00:00:00.000Z");
  });

  test("admins get every volunteer's dateOfBirth on the volunteers endpoint", async () => {
    const admin = await api.makeUser({ admin: true });
    const young = await api.makeUser({ dateOfBirth: "2012-01-31" });
    const legacy = await api.makeLegacyUser();
    const eventId = await api.makeEvent(admin);
    await api.call(young, "POST", `/api/events/${eventId}/register`);
    await api.call(legacy, "POST", `/api/events/${eventId}/register`);

    const res = await api.call(admin, "GET", `/api/events/${eventId}/volunteers`);
    assert.equal(res.status, 200);
    const byId = Object.fromEntries(res.body.map((v) => [v.userId, v]));
    assert.equal(byId[young.id].dateOfBirth, "2012-01-31T00:00:00.000Z");
    assert.equal(byId[legacy.id].dateOfBirth, null);
  });

  test("plain user queries leave dateOfBirth out unless asked for", async () => {
    const user = await api.makeUser({ dateOfBirth: "2005-06-15" });
    const plain = await User.findById(user.id);
    assert.equal(plain.dateOfBirth, undefined);
    const explicit = await User.findById(user.id).select("+dateOfBirth");
    assert.equal(explicit.dateOfBirth.toISOString(), "2005-06-15T00:00:00.000Z");
  });
});

describe("validation", () => {
  const register = (dateOfBirth, n) =>
    api.call(null, "POST", "/api/auth/register", {
      firstName: "Dob",
      lastName: "Check",
      email: `dob-${n}@example.com`,
      password: "Password1",
      phone: "5555550100",
      gender: "brother",
      ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
    });

  const rejected = [
    ["missing", undefined, "Date of birth is required"],
    ["not a date string", "14/03/2008", "Date of birth must look like 2008-03-14"],
    ["impossible date", "2010-02-30", "Enter a real date of birth"],
    ["future date", isoYearsAgo(-1), "Date of birth must be in the past"],
    ["today", isoYearsAgo(0), "Date of birth must be in the past"],
    ["one day short of 12", isoYearsAgo(12, 1), "You must be at least 12 years old"],
    ["100 or older", isoYearsAgo(100), "Enter a valid date of birth"],
  ];

  rejected.forEach(([label, value, message], n) => {
    test(`rejects ${label}`, async () => {
      const res = await register(value, `bad-${n}`);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, message);
    });
  });

  test("accepts exactly 12 today and 99, stored at UTC midnight", async () => {
    for (const [n, day] of [[1, isoYearsAgo(12)], [2, isoYearsAgo(100, 1)]]) {
      const res = await register(day, `ok-${n}`);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.user.dateOfBirth, midnightUtc(day));
    }
  });
});

describe("accounts created before dateOfBirth", () => {
  test("can log in, load /auth/me and be approved (hours added)", async () => {
    const admin = await api.makeUser({ admin: true });
    const legacy = await api.makeLegacyUser();

    const me = await api.call(legacy, "GET", "/api/auth/me");
    assert.equal(me.status, 200);
    assert.ok(!("dateOfBirth" in me.body));

    const eventId = await api.makeEvent(admin, { hours: 3 });
    await api.call(legacy, "POST", `/api/events/${eventId}/register`);
    await api.startEvent(eventId);
    const approve = await api.call(admin, "PATCH", `/api/events/${eventId}/volunteers/${legacy.id}/approve`);
    assert.equal(approve.status, 200);
    assert.equal((await User.findById(legacy.id)).volunteerHours, 3);
  });

  test("can set their dateOfBirth once; a second attempt gets 409", async () => {
    const legacy = await api.makeLegacyUser();
    const url = "/api/users/me/date-of-birth";

    const bad = await api.call(legacy, "PUT", url, { dateOfBirth: "2010-02-30" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.message, "Enter a real date of birth");

    const first = await api.call(legacy, "PUT", url, { dateOfBirth: "2010-02-28" });
    assert.equal(first.status, 200);
    assert.equal(first.body.user.dateOfBirth, "2010-02-28T00:00:00.000Z");

    const second = await api.call(legacy, "PUT", url, { dateOfBirth: "1990-01-01" });
    assert.equal(second.status, 409);
    assert.equal(second.body.message, "Date of birth is already set");
    const stored = await User.findById(legacy.id).select("+dateOfBirth");
    assert.equal(stored.dateOfBirth.toISOString(), "2010-02-28T00:00:00.000Z");
  });

  test("new accounts can't use the endpoint to change theirs", async () => {
    const user = await api.makeUser({ dateOfBirth: "2008-01-01" });
    const res = await api.call(user, "PUT", "/api/users/me/date-of-birth", { dateOfBirth: "1990-01-01" });
    assert.equal(res.status, 409);
  });

  test("setting dateOfBirth requires being signed in", async () => {
    const res = await api.call(null, "PUT", "/api/users/me/date-of-birth", { dateOfBirth: "2000-01-01" });
    assert.equal(res.status, 401);
  });
});
