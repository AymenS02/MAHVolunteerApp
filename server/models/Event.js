import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false },
);

const volunteerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gender: { type: String, enum: ["brother", "sister"], required: true },
    status: {
      type: String,
      enum: ["registered", "approved"],
      default: "registered",
    },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    hours: { type: Number, required: true },
    brothersMax: { type: Number, required: true, default: 0, min: 0 },
    sistersMax: { type: Number, required: true, default: 0, min: 0 },
    brothersContact: { type: contactSchema, default: undefined },
    sistersContact: { type: contactSchema, default: undefined },
    volunteers: { type: [volunteerSchema], default: [] },
  },
  { timestamps: true },
);

eventSchema.pre("validate", function enforceContactRequirements(next) {
  if (this.brothersMax > 0) {
    if (!this.brothersContact?.name || !this.brothersContact?.phone) {
      this.invalidate(
        "brothersContact",
        "Brothers contact name and phone are required when brothersMax > 0",
      );
    }
  } else {
    this.brothersContact = undefined;
  }

  if (this.sistersMax > 0) {
    if (!this.sistersContact?.name || !this.sistersContact?.phone) {
      this.invalidate(
        "sistersContact",
        "Sisters contact name and phone are required when sistersMax > 0",
      );
    }
  } else {
    this.sistersContact = undefined;
  }

  next();
});

export default mongoose.model("Event", eventSchema);
