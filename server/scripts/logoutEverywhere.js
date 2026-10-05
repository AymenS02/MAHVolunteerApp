// Signs a user out on every device by invalidating all their tokens.
// Usage: node scripts/logoutEverywhere.js user@email.com
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/logoutEverywhere.js user@email.com");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await User.updateOne({ email }, { $inc: { tokenVersion: 1 } });

  if (result.matchedCount === 0) {
    console.error("User not found");
    process.exitCode = 1;
  } else {
    console.log(`Signed ${email} out on all devices`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
