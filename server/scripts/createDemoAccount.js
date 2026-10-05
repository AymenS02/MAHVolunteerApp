// Creates (or resets) the volunteer account App Review signs in with, and
// prints its credentials for App Store Connect → App Review Information.
// It's a regular adult volunteer account: no admin access, so reviewers
// never see other volunteers' personal data.
// Usage: node scripts/createDemoAccount.js
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const EMAIL = "appreview@example.com";

// 16 random characters, plus the uppercase letter and digit the password
// rules require.
const password = `${randomBytes(12).toString("base64url")}A7`;

try {
  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email: EMAIL }).select("+password");
  const created = !user;

  if (!user) {
    user = new User({
      firstName: "App",
      lastName: "Review",
      email: EMAIL,
      phone: "5555550100",
      gender: "brother",
      role: "volunteer",
      dateOfBirth: new Date(Date.UTC(1990, 0, 1)),
    });
  }

  // The pre-save hook hashes it. Resetting also signs out old sessions.
  user.password = password;
  if (!created) user.$inc("tokenVersion", 1);
  await user.save();

  console.log(created ? "Created the App Review account." : "Reset the App Review account's password.");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${password}`);
  console.log("Put these in App Store Connect → App Review Information → Sign-in required.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
