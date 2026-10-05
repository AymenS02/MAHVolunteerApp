import User from "../models/User.js";
import { signToken } from "../utils/token.js";
import { createUser } from "./userController.js";

export const register = createUser;

// Body is validated by loginSchema in the route.
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password +dateOfBirth");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.json({ token, user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const me = async (req, res) => {
  return res.json(req.user.toJSON());
};
