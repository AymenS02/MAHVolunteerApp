import mongoose from "mongoose";

// A message an admin sent to an event's volunteers. Also shown in the app,
// so people with notifications off still see it.
const eventMessageSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
    includeWaitlist: { type: Boolean, default: false },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model("EventMessage", eventMessageSchema);
