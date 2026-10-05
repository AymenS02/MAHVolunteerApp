import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { startApp, startDb } from "./helpers.js";

const SERVER_ENTRY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.js");
const HOUR = 60 * 60 * 1000;

let stopDb;
let api;
let admin;

before(async () => {
  stopDb = await startDb();
  api = await startApp({ corsOrigins: ["http://localhost:8081"] });
  admin = await api.makeUser({ admin: true });
});

after(async () => {
  await api.stop();
  await stopDb();
});

describe("helmet", () => {
  test("sets security headers and hides Express", async () => {
    const res = await api.call(null, "GET", "/api/events");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok(res.headers.get("content-security-policy"));
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("cors", () => {
  test("allows a listed browser origin", async () => {
    const res = await api.call(admin, "GET", "/api/events", undefined, { Origin: "http://localhost:8081" });
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:8081");
  });

  test("gives no CORS header to other origins", async () => {
    const res = await api.call(admin, "GET", "/api/events", undefined, { Origin: "https://evil.example" });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  test("native requests without an Origin still work", async () => {
    const res = await api.call(admin, "GET", "/api/events");
    assert.equal(res.status, 200);
  });
});

describe("rate limits", () => {
  let limited;

  before(async () => {
    limited = await startApp({ rateLimits: { loginMax: 10, registerMax: 5 } });
  });

  after(() => limited.stop());

  test("11th failed login for one email gets 429; other emails on the same IP don't", async () => {
    const user = await api.makeUser();
    for (let i = 0; i < 10; i++) {
      const res = await limited.call(null, "POST", "/api/auth/login", { email: user.email, password: "wrong" });
      assert.equal(res.status, 401);
    }
    const blocked = await limited.call(null, "POST", "/api/auth/login", { email: user.email, password: user.password });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.message, "Too many login attempts. Try again in 15 minutes.");

    const other = await api.makeUser();
    const res = await limited.call(null, "POST", "/api/auth/login", { email: other.email, password: "wrong" });
    assert.equal(res.status, 401);
  });

  test("successful logins don't count toward the limit", async () => {
    const user = await api.makeUser();
    for (let i = 0; i < 12; i++) {
      const res = await limited.call(null, "POST", "/api/auth/login", { email: user.email, password: user.password });
      assert.equal(res.status, 200);
    }
  });

  test("6th registration per IP gets 429, across both register paths", async () => {
    const register = (route, n) =>
      limited.call(null, "POST", route, {
        firstName: "Rate",
        lastName: "Limit",
        email: `ratelimit-${n}@example.com`,
        password: "Password1",
        phone: "5555550100",
        gender: "brother",
        dateOfBirth: "2000-01-01",
      });

    for (let n = 0; n < 5; n++) {
      assert.equal((await register("/api/auth/register", n)).status, 201);
    }
    const blocked = await register("/api/users", 5);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.message, "Too many accounts created from this network. Try again later.");
  });
});

describe("validation", () => {
  const event = (overrides) => ({
    name: "Valid",
    date: new Date(Date.now() + 48 * HOUR).toISOString(),
    location: "Hall",
    hours: 3,
    brothersMax: 1,
    sistersMax: 0,
    brothersContact: { name: "C", phone: "1" },
    ...overrides,
  });

  const cases = [
    ["hours over 24", { hours: 30 }, "Hours can't be more than 24"],
    ["zero hours", { hours: 0 }, "Hours must be greater than 0"],
    ["name too long", { name: "x".repeat(121) }, "Name must be 120 characters or fewer"],
    ["date over 2 years out", { date: new Date(Date.now() + 3 * 365 * 24 * HOUR).toISOString() }, "Date must be within the next 2 years"],
    ["too many spots", { brothersMax: 501 }, "Spots per group can't be more than 500"],
    ["missing contact", { brothersContact: undefined }, "Brothers contact is required when brothers needed is greater than 0"],
  ];

  for (const [label, overrides, message] of cases) {
    test(`rejects ${label} with a readable message`, async () => {
      const res = await api.call(admin, "POST", "/api/events", event(overrides));
      assert.equal(res.status, 400);
      assert.equal(res.body.message, message);
      assert.ok(Array.isArray(res.body.errors));
    });
  }

  test("accepts a past date (logging an event after the fact)", async () => {
    const res = await api.call(admin, "POST", "/api/events", event({ date: new Date(Date.now() - 24 * HOUR).toISOString() }));
    assert.equal(res.status, 201);
  });

  test("non-admins can't create events, even with a valid body", async () => {
    const user = await api.makeUser();
    assert.equal((await api.call(user, "POST", "/api/events", event({}))).status, 403);
  });

  test("malformed ids still answer 404", async () => {
    const res = await api.call(admin, "GET", "/api/events/not-an-id");
    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Event not found");
    const vol = await api.call(admin, "PATCH", `/api/events/${"a".repeat(24)}/volunteers/nope/approve`);
    assert.equal(vol.status, 404);
    assert.equal(vol.body.message, "Volunteer not found");
  });

  test("unknown routes and malformed JSON answer JSON, not HTML", async () => {
    const missing = await api.call(admin, "GET", "/api/nope");
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { message: "Not found" });

    const res = await fetch(`${api.base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { message: "Invalid request" });
  });

  test("login without a password keeps the { message } shape the app reads", async () => {
    const res = await api.call(null, "POST", "/api/auth/login", { email: "a@b.c" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { message: "Email and password are required" });
  });
});

describe("token version", () => {
  test("bumping tokenVersion signs the user out everywhere", async () => {
    const user = await api.makeUser();
    assert.equal((await api.call(user, "GET", "/api/auth/me")).status, 200);

    await User.updateOne({ _id: user.id }, { $inc: { tokenVersion: 1 } });
    assert.equal((await api.call(user, "GET", "/api/auth/me")).status, 401);

    const login = await api.call(null, "POST", "/api/auth/login", { email: user.email, password: user.password });
    assert.equal(login.status, 200);
    assert.equal((await api.call({ token: login.body.token }, "GET", "/api/auth/me")).status, 200);
  });

  test("tokens issued before tokenVersion existed keep working", async () => {
    const user = await api.makeUser();
    const legacy = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    assert.equal((await api.call({ token: legacy }, "GET", "/api/auth/me")).status, 200);
  });
});

describe("startup", () => {
  // Runs server.js from an empty directory so no .env is loaded.
  const runServer = (env) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: os.tmpdir(),
        env: { ...process.env, PORT: "0", ...env },
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk));
      const timer = setTimeout(() => child.kill(), 15000);
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ code, stderr });
      });
    });

  test("exits with code 1 when Mongo can't connect", async () => {
    const { code, stderr } = await runServer({ MONGO_URI: "not-a-mongo-uri", JWT_SECRET: "x" });
    assert.equal(code, 1);
    assert.match(stderr, /MongoDB connection failed/);
  });

  test("exits with code 1 when JWT_SECRET is missing", async () => {
    const { code, stderr } = await runServer({ MONGO_URI: "not-a-mongo-uri", JWT_SECRET: "" });
    assert.equal(code, 1);
    assert.match(stderr, /JWT_SECRET is not set/);
  });
});
