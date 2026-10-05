import Event from "../models/Event.js";
import EventMessage from "../models/EventMessage.js";
import User from "../models/User.js";
import { notifyEventMessage } from "../services/notifications.js";
import { waitingFor } from "../services/roster.js";

const DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const waitlisted = (event) =>
  [...waitingFor(event, "brother"), ...waitingFor(event, "sister")].map((w) => w.user);

// Admin: message everyone signed up for an event (optionally the waitlist
// too). Saved so it also shows in the app, then pushed.
export const sendEventMessage = async (req, res) => {
  try {
    const { body, includeWaitlist } = req.body;
    const event = await Event.findOne({ _id: req.params.id, deletedAt: null });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const recent = await EventMessage.countDocuments({
      event: event._id,
      createdAt: { $gte: new Date(Date.now() - DAY_MS) },
    });
    if (recent >= DAILY_LIMIT) {
      return res.status(429).json({
        message: `You can send up to ${DAILY_LIMIT} messages per event per day`,
      });
    }

    const recipients = [
      ...event.volunteers.map((v) => v.user),
      ...(includeWaitlist ? waitlisted(event) : []),
    ];

    const message = await EventMessage.create({
      event: event._id,
      sentBy: req.user._id,
      body,
      includeWaitlist,
      recipientCount: recipients.length,
    });

    notifyEventMessage(recipients, event, body);

    return res.status(201).json({
      id: message._id,
      body: message.body,
      createdAt: message.createdAt,
      recipientCount: message.recipientCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Volunteers signed up for the event (and admins) can read its messages;
// waitlisted people see the ones that included them.
export const listEventMessages = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, deletedAt: null });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const isAdmin = req.user.role === "admin";
    const signedUp = event.volunteers.some((v) => v.user.equals(req.user._id));
    const onWaitlist = waitlisted(event).some((user) => user.equals(req.user._id));

    if (!isAdmin && !signedUp && !onWaitlist) {
      return res.status(403).json({
        message: "Only volunteers signed up for this event can see its messages",
      });
    }

    const messages = await EventMessage.find({
      event: event._id,
      ...(isAdmin || signedUp ? {} : { includeWaitlist: true }),
    }).sort({ createdAt: -1 });

    if (!isAdmin) {
      return res.json(
        messages.map((m) => ({ id: m._id, body: m.body, createdAt: m.createdAt })),
      );
    }

    const senders = await User.find({
      _id: { $in: messages.map((m) => m.sentBy) },
    }).select("firstName lastName");

    return res.json(
      messages.map((m) => {
        const sender = senders.find((s) => s._id.equals(m.sentBy));
        return {
          id: m._id,
          body: m.body,
          createdAt: m.createdAt,
          recipientCount: m.recipientCount,
          includeWaitlist: m.includeWaitlist,
          sentBy: sender ? `${sender.firstName} ${sender.lastName}` : "Deleted admin",
        };
      }),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
