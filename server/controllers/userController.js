import User from "../models/User.js";
import { createUserSchema } from "../validators/userValidator.js";

export const createUser = async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.errors,
      });
    }

    const { firstName, lastName, email, password, phone, highschoolStudent } =
      validation.data;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

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
      role: "volunteer",
      highschoolStudent,
    });

    return res.status(201).json(newUser);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
