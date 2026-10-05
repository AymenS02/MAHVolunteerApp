// Backfills volunteers[].hoursAwarded for approvals made before the field existed.
// Safe to run more than once: only entries still missing the field are touched.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Event from "../models/Event.js";

dotenv.config();

const missingHours = {
  $and: [
    { $eq: ["$$v.status", "approved"] },
    { $eq: [{ $type: "$$v.hoursAwarded" }, "missing"] },
  ],
};

try {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await Event.collection.updateMany(
    {
      volunteers: {
        $elemMatch: { status: "approved", hoursAwarded: { $exists: false } },
      },
    },
    [
      {
        $set: {
          volunteers: {
            $map: {
              input: "$volunteers",
              as: "v",
              in: {
                $cond: [
                  missingHours,
                  { $mergeObjects: ["$$v", { hoursAwarded: "$hours" }] },
                  "$$v",
                ],
              },
            },
          },
        },
      },
    ],
  );

  console.log(`Backfilled hoursAwarded on ${result.modifiedCount} event(s)`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
