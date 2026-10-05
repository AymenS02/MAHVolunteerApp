import mongoose from "mongoose";

// Notifications that wait a little before going out:
// - eventChanged: batches quick edits; `snapshot` holds the values before the
//   first edit, so only the net change is announced
// - eventDeleted: waits out the Undo window
// - eventRestored: "back on" for people who got the cancellation notice
const outboxSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["eventChanged", "eventDeleted", "eventRestored"],
      required: true,
    },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    sendAfter: { type: Date, required: true, index: true },
    snapshot: { type: mongoose.Schema.Types.Mixed },
    // true until a job claims it; lets edits be merged into one pending entry
    open: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// At most one pending entry per event and kind.
outboxSchema.index(
  { kind: 1, event: 1 },
  { unique: true, partialFilterExpression: { open: true } },
);

export default mongoose.model("Outbox", outboxSchema);
