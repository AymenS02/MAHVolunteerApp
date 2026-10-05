// Safety net for waitlists. Promotion normally happens right after a spot
// frees up; if the server stopped in between, this fills any open spots from
// the waitlist and clears waitlists of events within 10 hours.
// Usage: node scripts/promoteWaitlists.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import { promoteFromWaitlist } from "../services/roster.js";

dotenv.config();

try {
  await mongoose.connect(process.env.MONGO_URI);

  const events = await Event.find({ deletedAt: null, "waitlist.0": { $exists: true } })
    .select("_id name waitlist")
    .lean();

  for (const event of events) {
    const before = event.waitlist.length;
    await promoteFromWaitlist(event._id);
    const after = (await Event.findById(event._id).select("waitlist").lean()).waitlist.length;
    if (after !== before) {
      console.log(`${event.name}: waitlist ${before} -> ${after}`);
    }
  }

  console.log(`Checked ${events.length} event(s) with a waitlist`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
