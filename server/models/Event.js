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
    // Admin partial-hour adjustments change it (see HourAdjustment).
    hoursAwarded: { type: Number },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    // When an admin last changed the event's hours, which resets this
    // entry's hoursAwarded to the new event hours.
    hoursResetAt: { type: Date },
    // Missing on registrations made before this field existed.
    registeredAt: { type: Date },
    // Set when this registration came from the waitlist.
    promotedAt: { type: Date },
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
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    removedAt: { type: Date, default: Date.now },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

// People waiting for a spot. Array order is the queue (new people are only
// ever appended); each group queues separately.
const waitlistEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gender: { type: String, enum: ["brother", "sister"], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    // What to bring, where to meet, etc.
    description: { type: String, trim: true },
    hours: { type: Number, required: true },
    brothersMax: { type: Number, required: true, default: 0, min: 0 },
    sistersMax: { type: Number, required: true, default: 0, min: 0 },
    brothersContact: { type: contactSchema, default: undefined },
    sistersContact: { type: contactSchema, default: undefined },
    volunteers: { type: [volunteerSchema], default: [] },
    // A user is in at most one of volunteers, removedVolunteers and waitlist.
    removedVolunteers: { type: [removedVolunteerSchema], default: [] },
    // Ignored (and cleared) once the event is within 10 hours: see services/roster.js.
    waitlist: { type: [waitlistEntrySchema], default: [] },
    // Soft delete: null while the event is live.
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // When set, only these accounts (and admins) can see or join the event.
    // Used for the App Review sample events; real events leave it unset.
    visibleTo: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: undefined,
    },
    // Set when an admin moves the event. People registered before the
    // change may cancel even inside the 10-hour lock.
    previousDate: { type: Date },
    dateChangedAt: { type: Date },
  },
  { timestamps: true },
);

// Hours history looks events up by volunteer.
eventSchema.index({ "volunteers.user": 1 });
// Paged upcoming/past lists.
eventSchema.index({ deletedAt: 1, date: 1, _id: 1 });

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
