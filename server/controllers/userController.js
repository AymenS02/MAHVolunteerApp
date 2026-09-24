import User from "../models/User.js";

export const createUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    const newUser = await User.create({
      name,
      email,
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
