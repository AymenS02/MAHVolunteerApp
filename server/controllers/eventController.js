import { z } from "zod";
import Event from "../models/Event.js";
import User from "../models/User.js";

const eventInputSchema = z
  .object({
    name: z.string().min(1),
    date: z.coerce.date(),
    location: z.string().min(1),
    hours: z.number().nonnegative(),
    brothersMax: z.number().int().min(0),
    sistersMax: z.number().int().min(0),
    brothersContact: z
      .object({ name: z.string().min(1), phone: z.string().min(1) })
      .optional(),
    sistersContact: z
      .object({ name: z.string().min(1), phone: z.string().min(1) })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.brothersMax > 0 && !data.brothersContact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["brothersContact"],
        message: "Brothers contact is required when brothers needed is greater than 0",
      });
    }

    if (data.sistersMax > 0 && !data.sistersContact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sistersContact"],
        message: "Sisters contact is required when sisters needed is greater than 0",
      });
    }
  });

const formatEventForUser = (event, userId, userGender) => {
  const eventObj = event.toObject();
  const brothersRegistered = eventObj.volunteers.filter(
    (v) => v.gender === "brother",
  ).length;
  const sistersRegistered = eventObj.volunteers.filter(
    (v) => v.gender === "sister",
  ).length;
  const myEntry = eventObj.volunteers.find((v) => v.user.toString() === userId);

  const response = {
    ...eventObj,
    brothersRegistered,
    sistersRegistered,
    myStatus: myEntry?.status ?? null,
  };

  if (!myEntry) {
    delete response.brothersContact;
    delete response.sistersContact;
    return response;
  }

  if (userGender === "brother") {
    delete response.sistersContact;
  }

  if (userGender === "sister") {
    delete response.brothersContact;
  }

  return response;
};

export const listEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    const userId = req.user._id.toString();

    return res.json(
      events.map((event) => formatEventForUser(event, userId, req.user.gender)),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(
      formatEventForUser(event, req.user._id.toString(), req.user.gender),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createEvent = async (req, res) => {
  try {
    const parsed = eventInputSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.issues });
    }

    const event = await Event.create(parsed.data);
    return res.status(201).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (new Date() >= event.date) {
      return res.status(400).json({ message: "Event has already started" });
    }

    const userId = req.user._id.toString();
    const userGender = req.user.gender;

    if (event.volunteers.some((v) => v.user.toString() === userId)) {
      return res.status(400).json({ message: "You are already registered" });
    }

    const maxForGender = userGender === "brother" ? event.brothersMax : event.sistersMax;
    if (maxForGender === 0) {
      return res
        .status(400)
        .json({ message: `This event does not need ${userGender}s` });
    }

    const registeredForGender = event.volunteers.filter(
      (v) => v.gender === userGender,
    ).length;

    if (registeredForGender >= maxForGender) {
      return res
        .status(400)
        .json({ message: `No spots left for ${userGender}s` });
    }

    event.volunteers.push({
      user: req.user._id,
      gender: userGender,
      status: "registered",
    });

    await event.save();

    return res.json(
      formatEventForUser(event, req.user._id.toString(), req.user.gender),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const cancelRegistration = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = req.user._id.toString();
    const volunteer = event.volunteers.find((v) => v.user.toString() === userId);

    if (!volunteer) {
      return res.status(400).json({ message: "You are not registered for this event" });
    }

    if (volunteer.status !== "registered") {
      return res
        .status(400)
        .json({ message: "Only pending registrations can be cancelled" });
    }

    const lockTime = new Date(event.date.getTime() - 10 * 60 * 60 * 1000);
    if (new Date() >= lockTime) {
      return res
        .status(400)
        .json({ message: "Cancellation is locked within 10 hours of the event" });
    }

    event.volunteers = event.volunteers.filter((v) => v.user.toString() !== userId);
    await event.save();

    return res.json(
      formatEventForUser(event, req.user._id.toString(), req.user.gender),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEventVolunteers = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate({
      path: "volunteers.user",
      select: "firstName lastName phone gender",
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(
      event.volunteers.map((volunteer) => ({
        userId: volunteer.user._id,
        firstName: volunteer.user.firstName,
        lastName: volunteer.user.lastName,
        phone: volunteer.user.phone,
        gender: volunteer.gender,
        status: volunteer.status,
      })),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveVolunteer = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const volunteer = event.volunteers.find(
      (v) => v.user.toString() === req.params.userId,
    );

    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer not found" });
    }

    if (volunteer.status === "approved") {
      return res.json({ message: "Volunteer already approved" });
    }

    volunteer.status = "approved";
    await event.save();

    await User.findByIdAndUpdate(req.params.userId, { $inc: { volunteerHours: event.hours } });

    return res.json({ message: "Volunteer approved" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
