import mongoose from "mongoose";

// Claims a notification before it's sent, so each one goes out at most once
// even if a job runs twice or on two servers. `key` distinguishes repeats,
// e.g. the event date for reminders (a moved event gets a new reminder).
const notificationLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    kind: { type: String, required: true },
    key: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationLogSchema.index({ user: 1, event: 1, kind: 1, key: 1 }, { unique: true });

export default mongoose.model("NotificationLog", notificationLogSchema);
