import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import User from "../models/User.js";
import { startApp, startDb } from "./helpers.js";

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

const profile = { firstName: "Amina", lastName: "Yusuf", phone: "5555550123" };

describe("edit profile", () => {
  test("updates only the signed-in user", async () => {
    const me = await api.makeUser();
    const other = await api.makeUser();
    const otherBefore = (await User.findById(other.id)).toObject();

    const res = await api.call(me, "PATCH", "/api/users/me", profile);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.firstName, "Amina");
    assert.equal(res.body.user.phone, "5555550123");
    assert.equal(res.body.user.dateOfBirth, "2000-01-01T00:00:00.000Z");

    const otherAfter = (await User.findById(other.id)).toObject();
    assert.deepEqual(otherAfter, otherBefore);
  });

  test("there is no route for editing another user by id", async () => {
    const me = await api.makeUser();
    const other = await api.makeUser();

    for (const method of ["PATCH", "PUT"]) {
      const res = await api.call(me, method, `/api/users/${other.id}`, profile);
      assert.equal(res.status, 404, method);
    }
    assert.equal((await User.findById(other.id)).firstName, "Test");
  });

  test("rejects fields that aren't editable and changes nothing", async () => {
    const me = await api.makeUser();
    const before = (await User.findById(me.id).select("+dateOfBirth")).toObject();

    const attempts = [
      { role: "admin" },
      { email: "new@example.com" },
      { volunteerHours: 500 },
      { _id: "0".repeat(24) },
      { tokenVersion: 0 },
      { dateOfBirth: "1990-01-01" },
    ];
    for (const extra of attempts) {
      const res = await api.call(me, "PATCH", "/api/users/me", { ...profile, ...extra });
      assert.equal(res.status, 400, JSON.stringify(extra));
    }

    const after = (await User.findById(me.id).select("+dateOfBirth")).toObject();
    assert.deepEqual(after, before);
  });

  test("validates fields with readable messages", async () => {
    const me = await api.makeUser();
    const cases = [
      [{ firstName: "A" }, "First name must be at least 2 characters"],
      [{ lastName: " " }, "Last name must be at least 2 characters"],
      [{ phone: "123" }, "Phone number must be at least 10 digits"],
      [{ firstName: "x".repeat(51) }, "First name must be 50 characters or fewer"],
    ];
    for (const [change, message] of cases) {
      const res = await api.call(me, "PATCH", "/api/users/me", { ...profile, ...change });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, message);
    }
  });

  test("trims names and phone", async () => {
    const me = await api.makeUser();
    const res = await api.call(me, "PATCH", "/api/users/me", {
      firstName: "  Amina ",
      lastName: " Yusuf",
      phone: " 5555550123 ",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.firstName, "Amina");
    assert.equal(res.body.user.lastName, "Yusuf");
    assert.equal(res.body.user.phone, "5555550123");
  });

  test("requires being signed in", async () => {
    assert.equal((await api.call(null, "PATCH", "/api/users/me", profile)).status, 401);
  });

  test("accounts without a date of birth can still edit", async () => {
    const legacy = await api.makeLegacyUser();
    const res = await api.call(legacy, "PATCH", "/api/users/me", profile);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.firstName, "Amina");
  });
});

describe("change password", () => {
  const url = "/api/users/me/password";
  const login = (user, password) =>
    api.call(null, "POST", "/api/auth/login", { email: user.email, password });

  test("a wrong current password is rejected with 400 (not 401) and nothing changes", async () => {
    const me = await api.makeUser();
    const res = await api.call(me, "PUT", url, { currentPassword: "Wrong123", newPassword: "Newpass1" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Current password is incorrect");

    assert.equal((await login(me, me.password)).status, 200);
    assert.equal((await login(me, "Newpass1")).status, 401);
    // The session survives a typo.
    assert.equal((await api.call(me, "GET", "/api/auth/me")).status, 200);
  });

  test("new password follows the registration rules and must differ", async () => {
    const me = await api.makeUser();
    const cases = [
      ["short", "Ab1", "Password must be at least 6 characters"],
      ["no uppercase", "lowercase1", "Password must contain at least one uppercase letter"],
      ["same as current", me.password, "New password must be different from your current password"],
    ];
    for (const [label, newPassword, message] of cases) {
      const res = await api.call(me, "PUT", url, { currentPassword: me.password, newPassword });
      assert.equal(res.status, 400, label);
      assert.equal(res.body.message, message, label);
    }
    const missing = await api.call(me, "PUT", url, { newPassword: "Newpass1" });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.message, "Current password is required");
  });

  test("success: new password works, old doesn't, other devices are signed out", async () => {
    const me = await api.makeUser();
    const otherDevice = (await login(me, me.password)).body.token;

    const res = await api.call(me, "PUT", url, { currentPassword: me.password, newPassword: "Newpass1" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);

    assert.equal((await login(me, "Newpass1")).status, 200);
    assert.equal((await login(me, me.password)).status, 401);
    assert.equal((await api.call({ token: otherDevice }, "GET", "/api/auth/me")).status, 401);
    assert.equal((await api.call(me, "GET", "/api/auth/me")).status, 401);
    assert.equal((await api.call({ token: res.body.token }, "GET", "/api/auth/me")).status, 200);

    const stored = await User.findById(me.id).select("+password");
    assert.notEqual(stored.password, "Newpass1", "password must be stored hashed");
  });

  test("requires being signed in", async () => {
    const res = await api.call(null, "PUT", url, { currentPassword: "x", newPassword: "Newpass1" });
    assert.equal(res.status, 401);
  });

  test("rate limit: 6th failed attempt gets 429, per user", async () => {
    const limited = await startApp({ rateLimits: { passwordMax: 5 } });
    try {
      const me = await api.makeUser();
      const other = await api.makeUser();
      const wrong = { currentPassword: "Wrong123", newPassword: "Newpass1" };

      for (let i = 0; i < 5; i++) {
        assert.equal((await limited.call(me, "PUT", url, wrong)).status, 400);
      }
      const blocked = await limited.call(me, "PUT", url, { currentPassword: me.password, newPassword: "Newpass1" });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.message, "Too many password attempts. Try again in 15 minutes.");

      // Another user (same IP) isn't affected.
      assert.equal((await limited.call(other, "PUT", url, wrong)).status, 400);
    } finally {
      await limited.stop();
    }
  });
});
