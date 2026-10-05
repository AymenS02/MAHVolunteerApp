import mongoose from "mongoose";

// Append-only audit trail for admin hour changes. Nothing updates or deletes
// these; a correction is a new adjustment with its own reason.
//
// With `event`, the adjustment changed that volunteer's hoursAwarded on the
// event (e.g. left early). Without it, it's a standalone correction that
// counts on its own in the history.
const hourAdjustmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The user's total immediately before and after this adjustment.
    before: { type: Number, required: true },
    after: { type: Number, required: true },
    // For event adjustments: that event's hoursAwarded before and after.
    eventHoursBefore: { type: Number },
    eventHoursAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("HourAdjustment", hourAdjustmentSchema);
