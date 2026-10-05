import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import Event from "../models/Event.js";
import User from "../models/User.js";

process.env.JWT_SECRET ||= "test-secret";

const HOUR = 60 * 60 * 1000;
let userCount = 0;

// Starts an in-memory replica set (transactions need one) and connects
// mongoose. Never touches the real database.
export const startDb = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([User.init(), Event.init()]);

  return async () => {
    await mongoose.disconnect();
    await replSet.stop();
  };
};

// Starts an app on a random port. Rate limits are high unless a test passes
// its own, so setup code can create many users.
export const startApp = async (options = {}) => {
  const app = createApp({
    corsOrigins: [],
    ...options,
    rateLimits: {
      loginMax: 10000,
      registerMax: 10000,
      passwordMax: 10000,
      ...options.rateLimits,
    },
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (who, method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(who?.token ? { Authorization: `Bearer ${who.token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };

  const makeUser = async ({
    gender = "brother",
    admin = false,
    dateOfBirth = "2000-01-01",
  } = {}) => {
    const email = `test-${++userCount}@example.com`;
    const password = "Password1";
    const res = await call(null, "POST", "/api/auth/register", {
      firstName: "Test",
      lastName: `User ${userCount}`,
      email,
      password,
      phone: "5555550100",
      gender,
      dateOfBirth,
    });
    if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
    if (admin) await User.updateOne({ email }, { role: "admin" });
    return { id: res.body.user._id, token: res.body.token, email, password, gender, dateOfBirth };
  };

  // An account created before dateOfBirth existed: inserted directly, then
  // signed in through the API.
  const makeLegacyUser = async ({ gender = "brother" } = {}) => {
    const email = `legacy-${++userCount}@example.com`;
    const password = "Password1";
    await User.create({
      firstName: "Legacy",
      lastName: `User ${userCount}`,
      email,
      password,
      phone: "5555550100",
      gender,
    });
    const res = await call(null, "POST", "/api/auth/login", { email, password });
    if (res.status !== 200) throw new Error(`legacy login failed: ${JSON.stringify(res.body)}`);
    return { id: res.body.user._id, token: res.body.token, email, password, gender };
  };

  const makeEvent = async (admin, overrides = {}) => {
    const contact = { name: "Coordinator", phone: "5555550199" };
    const res = await call(admin, "POST", "/api/events", {
      name: "Test event",
      date: new Date(Date.now() + 48 * HOUR).toISOString(),
      location: "Test hall",
      hours: 3,
      brothersMax: 2,
      sistersMax: 2,
      brothersContact: contact,
      sistersContact: contact,
      ...overrides,
    });
    if (res.status !== 201) throw new Error(`create event failed: ${JSON.stringify(res.body)}`);
    return res.body._id;
  };

  // Moves an event's start into the past: you can only register before an
  // event starts and only approve hours after.
  const startEvent = (eventId) =>
    Event.updateOne({ _id: eventId }, { $set: { date: new Date(Date.now() - HOUR) } });

  // Registers, starts the event and approves: hours are awarded.
  const attend = async (admin, user, eventId) => {
    await call(user, "POST", `/api/events/${eventId}/register`);
    await startEvent(eventId);
    const res = await call(admin, "PATCH", `/api/events/${eventId}/volunteers/${user.id}/approve`);
    if (res.status !== 200) throw new Error(`approve failed: ${JSON.stringify(res.body)}`);
  };

  const stop = () => new Promise((resolve) => server.close(resolve));

  return { base, call, makeUser, makeLegacyUser, makeEvent, startEvent, attend, stop };
};
