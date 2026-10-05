import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    gender: {
      type: String,
      enum: ["brother", "sister"],
      required: true,
    },
    role: {
      type: String,
      enum: ["volunteer", "admin"],
      default: "volunteer",
    },
    volunteerHours: {
      type: Number,
      default: 0,
    },
    highschoolStudent: { type: Boolean, default: false },
    // UTC midnight of the birth day. Not required here: accounts created
    // before this field existed must keep saving. Registration requires it.
    // select: false so it's only loaded where it's explicitly requested
    // (the user's own record and admin endpoints).
    dateOfBirth: { type: Date, select: false },
    // One switch for all push notifications.
    notificationsEnabled: { type: Boolean, default: true },
    // Bumped to invalidate every token issued to this user.
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
