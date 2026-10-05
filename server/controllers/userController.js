import Event from "../models/Event.js";
import PushToken from "../models/PushToken.js";
import User from "../models/User.js";
import { isPushToken } from "../services/push.js";
import { promoteFromWaitlist } from "../services/roster.js";
import { signToken } from "../utils/token.js";
import { createUserSchema } from "../validators/userValidator.js";

export const createUser = async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: validation.error.issues[0].message,
        errors: validation.error.issues,
      });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      gender,
      highschoolStudent,
      dateOfBirth,
    } = validation.data;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    const newUser = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      phone,
      gender,
      role: "volunteer",
      highschoolStudent,
      dateOfBirth,
    });

    const token = signToken(newUser);

    return res.status(201).json({ token, user: newUser.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// For accounts created before dateOfBirth existed. Set-once: changing it
// later could let a minor make themselves an adult, so that's admin-only.
// Body is validated by setDateOfBirthSchema in the route.
export const setMyDateOfBirth = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, dateOfBirth: null },
      { $set: { dateOfBirth: req.body.dateOfBirth } },
      { returnDocument: "after" },
    ).select("+dateOfBirth");

    if (!user) {
      return res.status(409).json({ message: "Date of birth is already set" });
    }

    return res.json({ user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Body is validated (and limited to these fields) by updateProfileSchema.
export const updateMyProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { firstName, lastName, phone } },
      { returnDocument: "after" },
    ).select("+dateOfBirth");

    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    return res.json({ user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// A wrong current password answers 400, not 401: the app treats any 401 as
// an expired session and signs the user out.
export const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // The pre-save hook hashes the new password. Bumping tokenVersion signs
    // out every other device; this one gets a fresh token below.
    user.password = newPassword;
    user.$inc("tokenVersion", 1);
    await user.save();
    // Signed-out devices stop getting notifications; this device registers
    // its token again right away.
    await PushToken.deleteMany({ user: user._id });

    return res.json({ message: "Password changed", token: signToken(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res
        .status(403)
        .json({ message: "Admins can't delete their own account." });
    }

    // Spots this user held go to the waitlist afterwards.
    const heldSpots = await Event.find({ "volunteers.user": req.user._id })
      .select("_id")
      .lean();

    // Remove the user from any events they signed up for, were removed from
    // or are waiting for.
    await Event.updateMany(
      {
        $or: [
          { "volunteers.user": req.user._id },
          { "removedVolunteers.user": req.user._id },
          { "waitlist.user": req.user._id },
        ],
      },
      {
        $pull: {
          volunteers: { user: req.user._id },
          removedVolunteers: { user: req.user._id },
          waitlist: { user: req.user._id },
        },
      },
    );

    await PushToken.deleteMany({ user: req.user._id });
    await User.findByIdAndDelete(req.user._id);

    for (const event of heldSpots) {
      await promoteFromWaitlist(event._id);
    }

    return res.json({ message: "Account deleted" });
  } catch (error) {
    console.error("[DELETE ACCOUNT] server error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Registers (or refreshes) this device. A token that belonged to another
// account on the same phone moves to this one.
export const savePushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!isPushToken(token)) {
      return res.status(400).json({ message: "Not a valid Expo push token" });
    }

    await PushToken.findOneAndUpdate(
      { token },
      { $set: { user: req.user._id, platform, lastSeenAt: new Date() } },
      { upsert: true },
    );

    return res.json({ message: "Device registered" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Called by the app on logout. Only removes the caller's own token.
export const deletePushToken = async (req, res) => {
  try {
    await PushToken.deleteOne({ token: req.params.token, user: req.user._id });
    return res.json({ message: "Device removed" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// The single on/off switch for push notifications.
export const setNotifications = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { notificationsEnabled: req.body.enabled } },
      { returnDocument: "after" },
    ).select("+dateOfBirth");

    return res.json({ user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
