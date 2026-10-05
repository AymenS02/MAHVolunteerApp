//server/server.js

import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { startScheduler } from "./services/notifications.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set");
  process.exit(1);
}

// Don't accept requests without a database: every route needs it.
try {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("MongoDB Connected");
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Reminders, nudges, delayed notices and delivery checks. Runs only while
// this server is up; timed reminders need an always-on host.
if (process.env.DISABLE_SCHEDULER !== "true") {
  startScheduler();
}
