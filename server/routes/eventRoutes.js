import express from "express";
import {
  approveVolunteer,
  cancelRegistration,
  createEvent,
  deleteEvent,
  getDeletedEvents,
  getEvent,
  getEventForEdit,
  getEventVolunteers,
  getRemovedVolunteers,
  getVolunteersCsv,
  getWaitlist,
  joinWaitlist,
  leaveWaitlist,
  listEvents,
  registerForEvent,
  removeVolunteer,
  restoreEvent,
  restoreVolunteer,
  undoCancelRegistration,
  unapproveVolunteer,
  updateEvent,
} from "../controllers/eventController.js";
import {
  listEventMessages,
  sendEventMessage,
} from "../controllers/messageController.js";
import { adminOnly, auth } from "../middleware/auth.js";
import { requireObjectId, validateBody } from "../middleware/validate.js";
import {
  createEventSchema,
  eventMessageSchema,
} from "../validators/eventValidator.js";

const router = express.Router();

router.use(auth);

router.param("id", requireObjectId("Event not found"));
router.param("userId", requireObjectId("Volunteer not found"));

router.get("/", listEvents);
// Must come before "/:id" so "deleted" isn't read as an event id.
router.get("/deleted", adminOnly, getDeletedEvents);
router.get("/:id", getEvent);
router.post("/", adminOnly, validateBody(createEventSchema), createEvent);
router.patch("/:id", adminOnly, validateBody(createEventSchema), updateEvent);
router.get("/:id/edit", adminOnly, getEventForEdit);
router.delete("/:id", adminOnly, deleteEvent);
router.post("/:id/restore", adminOnly, restoreEvent);
router.post("/:id/register", registerForEvent);
router.delete("/:id/register", cancelRegistration);
router.post("/:id/register/undo", undoCancelRegistration);
router.post("/:id/waitlist", joinWaitlist);
router.delete("/:id/waitlist", leaveWaitlist);
router.get("/:id/waitlist", adminOnly, getWaitlist);
router.post(
  "/:id/messages",
  adminOnly,
  validateBody(eventMessageSchema),
  sendEventMessage,
);
router.get("/:id/messages", listEventMessages);
router.get("/:id/volunteers", adminOnly, getEventVolunteers);
router.get("/:id/volunteers.csv", adminOnly, getVolunteersCsv);
router.patch("/:id/volunteers/:userId/approve", adminOnly, approveVolunteer);
router.patch("/:id/volunteers/:userId/unapprove", adminOnly, unapproveVolunteer);
router.get("/:id/volunteers/removed", adminOnly, getRemovedVolunteers);
router.delete("/:id/volunteers/:userId", adminOnly, removeVolunteer);
router.post("/:id/volunteers/:userId/restore", adminOnly, restoreVolunteer);

export default router;
