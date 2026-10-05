import jwt from "jsonwebtoken";

// `tv` must match user.tokenVersion; bumping the version signs the user out
// on every device (see scripts/logoutEverywhere.js).
export const signToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), tv: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
