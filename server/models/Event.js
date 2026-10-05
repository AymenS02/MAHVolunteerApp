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
    // Hours added to user.volunteerHours when approved; unapproving subtracts exactly this.
    hoursAwarded: { type: Number },
  },
  { _id: false },
);

// Volunteers an admin removed, kept so the removal can be undone.
const removedVolunteerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gender: { type: String, enum: ["brother", "sister"], required: true },
    previousStatus: {
      type: String,
      enum: ["registered", "approved"],
      required: true,
    },
    hoursAwarded: { type: Number },
    removedAt: { type: Date, default: Date.now },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
    // A user is never in both volunteers and removedVolunteers.
    removedVolunteers: { type: [removedVolunteerSchema], default: [] },
    // Soft delete: null while the event is live.
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

eventSchema.pre("validate", function enforceContactRequirements() {
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
});

export default mongoose.model("Event", eventSchema);
