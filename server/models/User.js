import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  role: {
    type: String,
    default: "volunteer",
  },
  volunteerHours: {
    type: Number,
    default: 0,
  },
  highschoolStudent: { type: Boolean, default: false },
});

export default mongoose.model("User", userSchema);
