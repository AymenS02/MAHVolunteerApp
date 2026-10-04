import express from "express";
import {
  approveVolunteer,
  cancelRegistration,
  createEvent,
  getEvent,
  getEventVolunteers,
  listEvents,
  registerForEvent,
} from "../controllers/eventController.js";
import { adminOnly, auth } from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", listEvents);
router.get("/:id", getEvent);
router.post("/", adminOnly, createEvent);
router.post("/:id/register", registerForEvent);
router.delete("/:id/register", cancelRegistration);
router.get("/:id/volunteers", adminOnly, getEventVolunteers);
router.patch("/:id/volunteers/:userId/approve", adminOnly, approveVolunteer);

export default router;
