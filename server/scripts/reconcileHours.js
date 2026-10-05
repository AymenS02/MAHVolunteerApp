// Compares each user's volunteerHours with the hours from their approved
// registrations. Reports differences by default; pass --apply to fix them.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import User from "../models/User.js";

dotenv.config();

const apply = process.argv.includes("--apply");

try {
  await mongoose.connect(process.env.MONGO_URI);

  const earned = await Event.aggregate([
    { $unwind: "$volunteers" },
    { $match: { "volunteers.status": "approved" } },
    {
      $group: {
        _id: "$volunteers.user",
        hours: { $sum: { $ifNull: ["$volunteers.hoursAwarded", "$hours"] } },
      },
    },
  ]);
  const expectedByUser = new Map(earned.map((e) => [e._id.toString(), e.hours]));

  const users = await User.find().select("email volunteerHours");
  const drift = users
    .map((user) => ({
      id: user._id,
      email: user.email,
      stored: user.volunteerHours ?? 0,
      expected: expectedByUser.get(user._id.toString()) ?? 0,
    }))
    .filter((row) => row.stored !== row.expected);

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
