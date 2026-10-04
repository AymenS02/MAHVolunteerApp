import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/makeAdmin.js user@email.com");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOneAndUpdate(
    { email },
    { role: "admin" },
    { new: true },
  );

  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  console.log(`Updated ${user.email} to admin`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
