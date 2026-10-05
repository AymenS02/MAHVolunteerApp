// Creates (or resets) two sample events that only the App Review account can
// see, so reviewers can try the app without touching real events:
// - an open event: register, cancel, Undo
// - a full event: join and leave the waitlist
// Real volunteers never see them; admins do, labelled "Sample".
// Re-run before each submission: dates move 30 days out and sign-ups reset.
// Run createDemoAccount.js first.
// Usage: node scripts/createReviewEvents.js
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import User from "../models/User.js";

dotenv.config();

const REVIEW_EMAIL = "appreview@example.com";
const FILLER_EMAIL = "sample.volunteer@example.com";
const CONTACT = {
  name: "MAH Canada volunteer team",
  phone: process.env.REVIEW_CONTACT_PHONE || "5550100100",
};

// 30 days from now, on the hour.
const inThirtyDays = () => {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setUTCMinutes(0, 0, 0);
  return date;
};

const upsertSample = async (name, fields) => {
  const existing = await Event.findOne({ name, visibleTo: { $exists: true } });
  const values = {
    name,
    location: "MAH Canada (sample event)",
    hours: 2,
    sistersMax: 0,
    brothersContact: CONTACT,
    date: inThirtyDays(),
    deletedAt: null,
    removedVolunteers: [],
    waitlist: [],
    ...fields,
  };
  if (existing) {
    existing.set(values);
    existing.previousDate = undefined;
    existing.dateChangedAt = undefined;
    await existing.save();
    return { event: existing, created: false };
  }
  return { event: await Event.create(values), created: true };
};

try {
  await mongoose.connect(process.env.MONGO_URI);

  const reviewer = await User.findOne({ email: REVIEW_EMAIL });
  if (!reviewer) {
    throw new Error("Run scripts/createDemoAccount.js first.");
  }

  // A placeholder adult that fills the full event's only spot. Its password
  // is random and never shown, so nobody can sign in as it.
  let filler = await User.findOne({ email: FILLER_EMAIL });
  if (!filler) {
    filler = await User.create({
      firstName: "Sample",
      lastName: "Volunteer",
      email: FILLER_EMAIL,
      password: `${randomBytes(24).toString("base64url")}A7`,
      phone: "5550100100",
      gender: "brother",
      role: "volunteer",
      dateOfBirth: new Date(Date.UTC(1990, 0, 1)),
      notificationsEnabled: false,
    });
  }

  const visibleTo = [reviewer._id];
  const now = new Date();

  const open = await upsertSample("Sample: Food bank shift", {
    description:
      "This is a sample event for App Review. Try registering, then cancelling (an Undo option appears). Only the review account can see it.",
    brothersMax: 5,
    volunteers: [],
    visibleTo,
  });

  const full = await upsertSample("Sample: Community iftar (full)", {
    description:
      "This sample event is full, so you can try joining and leaving the waitlist. Only the review account can see it.",
    brothersMax: 1,
    volunteers: [
      { user: filler._id, gender: "brother", status: "registered", registeredAt: now },
    ],
    visibleTo,
  });

  for (const { event, created } of [open, full]) {
    console.log(
      `${created ? "Created" : "Reset"} "${event.name}" on ${event.date.toISOString()}`,
    );
  }
  console.log(`Visible only to ${REVIEW_EMAIL} (and admins).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
