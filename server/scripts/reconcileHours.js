// Compares each user's stored volunteerHours with their hours history
// (approved events plus admin adjustments). Reports differences by default;
// pass --apply to fix them.
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import { buildHistory, roundHours } from "../services/hours.js";

dotenv.config();

const apply = process.argv.includes("--apply");

try {
  await mongoose.connect(process.env.MONGO_URI);

  // Same calculation the app shows: approved events plus adjustments.
  const users = await User.find().select("email volunteerHours");
  const drift = [];
  for (const user of users) {
    const { total } = await buildHistory(user._id);
    const stored = roundHours(user.volunteerHours ?? 0);
    if (stored !== total) {
      drift.push({ id: user._id, email: user.email, stored, expected: total });
    }
  }

  if (drift.length === 0) {
    console.log(`All ${users.length} users have correct volunteerHours`);
  } else {
    console.table(drift.map(({ email, stored, expected }) => ({ email, stored, expected })));

    if (apply) {
      await User.bulkWrite(
        drift.map((row) => ({
          updateOne: {
            filter: { _id: row.id },
            update: { $set: { volunteerHours: row.expected } },
          },
        })),
      );
      console.log(`Fixed ${drift.length} user(s)`);
    } else {
      console.log(`${drift.length} user(s) differ. Run with --apply to fix.`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
