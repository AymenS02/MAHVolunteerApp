import express from "express";
import {
  approveVolunteer,
  cancelRegistration,
  createEvent,
  deleteEvent,
  getDeletedEvents,
  getEvent,
  getEventVolunteers,
  getRemovedVolunteers,
  listEvents,
  registerForEvent,
  removeVolunteer,
  restoreEvent,
  restoreVolunteer,
  undoCancelRegistration,
  unapproveVolunteer,
} from "../controllers/eventController.js";
import { adminOnly, auth } from "../middleware/auth.js";

const router = express.Router();

const objectIdPattern = /^[a-f\d]{24}$/i;

// Malformed ids can never match a document, so answer 404 instead of a 500 CastError.
const requireObjectId = (message) => (req, res, next, value) =>
  objectIdPattern.test(value) ? next() : res.status(404).json({ message });

router.use(auth);

router.param("id", requireObjectId("Event not found"));
router.param("userId", requireObjectId("Volunteer not found"));

router.get("/", listEvents);
// Must come before "/:id" so "deleted" isn't read as an event id.
router.get("/deleted", adminOnly, getDeletedEvents);
router.get("/:id", getEvent);
router.post("/", adminOnly, createEvent);
router.delete("/:id", adminOnly, deleteEvent);
router.post("/:id/restore", adminOnly, restoreEvent);
router.post("/:id/register", registerForEvent);
router.delete("/:id/register", cancelRegistration);
router.post("/:id/register/undo", undoCancelRegistration);
router.get("/:id/volunteers", adminOnly, getEventVolunteers);
router.patch("/:id/volunteers/:userId/approve", adminOnly, approveVolunteer);
router.patch("/:id/volunteers/:userId/unapprove", adminOnly, unapproveVolunteer);
router.get("/:id/volunteers/removed", adminOnly, getRemovedVolunteers);
router.delete("/:id/volunteers/:userId", adminOnly, removeVolunteer);
router.post("/:id/volunteers/:userId/restore", adminOnly, restoreVolunteer);

export default router;
