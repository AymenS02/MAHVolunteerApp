import express from "express";
import { login, me, register } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../validators/authValidator.js";

const router = express.Router();

router.post("/register", register);
router.post(
  "/login",
  validateBody(loginSchema, { message: "Email and password are required" }),
  login,
);
router.get("/me", auth, me);

export default router;
