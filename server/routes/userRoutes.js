import express from "express";
import { createUser, deleteMyAccount } from "../controllers/userController.js";
import { auth } from "../middleware/auth.js"; // adjust to your middleware file name

const router = express.Router();

router.post("/", createUser);
router.delete("/me", auth, deleteMyAccount);

export default router;
