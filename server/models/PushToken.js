import mongoose from "mongoose";

// One per device. If another account signs in on the same phone, the token
// moves to that account (token is unique).
const pushTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ["ios", "android", "web"] },
  lastSeenAt: { type: Date, default: Date.now },
});

export default mongoose.model("PushToken", pushTokenSchema);
