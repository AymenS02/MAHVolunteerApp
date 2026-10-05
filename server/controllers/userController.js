import jwt from "jsonwebtoken";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { createUserSchema } from "../validators/userValidator.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

export const createUser = async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
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
    });

    const token = signToken(newUser._id.toString());

    return res.status(201).json({ token, user: newUser.toJSON() });
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

    // Remove the user from any events they signed up for
    await Event.updateMany(
      { "volunteers.user": req.user._id },
      { $pull: { volunteers: { user: req.user._id } } },
    );

    await User.findByIdAndDelete(req.user._id);

    return res.json({ message: "Account deleted" });
  } catch (error) {
    console.error("[DELETE ACCOUNT] server error:", error);
    return res.status(500).json({ message: error.message });
  }
};
