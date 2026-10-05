import Event from "../models/Event.js";
import User from "../models/User.js";
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

    // Remove the user from any events they signed up for or were removed from
    await Event.updateMany(
      {
        $or: [
          { "volunteers.user": req.user._id },
          { "removedVolunteers.user": req.user._id },
        ],
      },
      {
        $pull: {
          volunteers: { user: req.user._id },
          removedVolunteers: { user: req.user._id },
        },
      },
    );

    await User.findByIdAndDelete(req.user._id);

    return res.json({ message: "Account deleted" });
  } catch (error) {
    console.error("[DELETE ACCOUNT] server error:", error);
    return res.status(500).json({ message: error.message });
  }
};
