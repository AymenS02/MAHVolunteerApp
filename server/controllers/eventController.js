import mongoose from "mongoose";
import Event from "../models/Event.js";
import User from "../models/User.js";

const EVENT_DELETED = "This event was deleted";

const CANCEL_LOCK_MS = 10 * 60 * 60 * 1000;

const maxField = (gender) => (gender === "brother" ? "brothersMax" : "sistersMax");

// Runs fn in a transaction. fn may be retried on transient errors, so it must
// only write through the session and return its result instead of responding.
const inTransaction = async (fn) => {
  let result;
  await mongoose.connection.transaction(async (session) => {
    result = await fn(session);
  });
  return result;
};

const countGender = (event, gender) =>
  event.volunteers.filter((v) => v.gender === gender).length;

// Built field by field so volunteer data, admin fields and anything added to
// the model later never reach non-admin clients by accident.
const formatEventForUser = (event, userId, userGender) => {
  const myEntry = event.volunteers.find((v) => v.user.toString() === userId);

  const response = {
    _id: event._id,
    name: event.name,
    date: event.date,
    location: event.location,
    hours: event.hours,
    brothersMax: event.brothersMax,
    sistersMax: event.sistersMax,
    deletedAt: event.deletedAt ?? null,
    brothersRegistered: countGender(event, "brother"),
    sistersRegistered: countGender(event, "sister"),
    myStatus: myEntry?.status ?? null,
  };

  // Registered volunteers see only their own group's contact.
  const contactKey = `${userGender}sContact`;
  const contact = event[contactKey];

  if (myEntry && contact?.name) {
    response[contactKey] = { name: contact.name, phone: contact.phone };
  }

  return response;
};

export const listEvents = async (req, res) => {
  try {
    const events = await Event.find({ deletedAt: null }).sort({ date: 1 });
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
    const event = await Event.findOne({ _id: req.params.id, deletedAt: null });

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
    // Body is validated by createEventSchema in the route.
    const event = await Event.create(req.body);
    return res.status(201).json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Matches only while the event still has a free spot for this gender.
const hasSpotFor = (gender) => ({
  $expr: {
    $lt: [
      {
        $size: {
          $filter: {
            input: "$volunteers",
            as: "v",
            cond: { $eq: ["$$v.gender", gender] },
          },
        },
      },
      `$${maxField(gender)}`,
    ],
  },
});

// Explains why the atomic register update matched nothing.
const registerFailure = async (eventId, user) => {
  const event = await Event.findById(eventId);

  if (!event) {
    return { status: 404, message: "Event not found" };
  }

  if (event.deletedAt) {
    return { status: 410, message: EVENT_DELETED };
  }

  if (new Date() >= event.date) {
    return { status: 400, message: "Event has already started" };
  }

  if (event.volunteers.some((v) => v.user.equals(user._id))) {
    return { status: 400, message: "You are already registered" };
  }

  if (event[maxField(user.gender)] === 0) {
    return { status: 400, message: `This event does not need ${user.gender}s` };
  }

  return { status: 400, message: `No spots left for ${user.gender}s` };
};

export const registerForEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const userGender = req.user.gender;

    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: null,
        date: { $gt: new Date() },
        "volunteers.user": { $ne: userId },
        ...hasSpotFor(userGender),
      },
      {
        $push: {
          volunteers: { user: userId, gender: userGender, status: "registered" },
        },
        // Re-registering replaces any earlier removal by an admin.
        $pull: { removedVolunteers: { user: userId } },
      },
      { returnDocument: "after" },
    );

    if (!event) {
      const failure = await registerFailure(req.params.id, req.user);
      return res.status(failure.status).json({ message: failure.message });
    }

    return res.json(formatEventForUser(event, userId.toString(), userGender));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const cancelRegistration = async (req, res) => {
  try {
    const userId = req.user._id;

    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: null,
        date: { $gt: new Date(Date.now() + CANCEL_LOCK_MS) },
        volunteers: { $elemMatch: { user: userId, status: "registered" } },
      },
      { $pull: { volunteers: { user: userId, status: "registered" } } },
      { returnDocument: "after" },
    );

    if (event) {
      return res.json(
        formatEventForUser(event, userId.toString(), req.user.gender),
      );
    }

    const current = await Event.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (current.deletedAt) {
      return res.status(410).json({ message: EVENT_DELETED });
    }

    const volunteer = current.volunteers.find((v) => v.user.equals(userId));

    if (!volunteer) {
      return res.status(400).json({ message: "You are not registered for this event" });
    }

    if (volunteer.status !== "registered") {
      return res
        .status(400)
        .json({ message: "Only pending registrations can be cancelled" });
    }

    return res
      .status(400)
      .json({ message: "Cancellation is locked within 10 hours of the event" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEventVolunteers = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      deletedAt: null,
    }).populate({
      path: "volunteers.user",
      select: "firstName lastName phone gender",
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(
      event.volunteers
        .filter((volunteer) => volunteer.user)
        .map((volunteer) => ({
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
    const { id, userId } = req.params;

    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id)
        .select("hours deletedAt")
        .session(session);

      if (!event) {
        return { status: 404, body: { message: "Event not found" } };
      }

      if (event.deletedAt) {
        return { status: 410, body: { message: EVENT_DELETED } };
      }

      // Only the request that flips registered -> approved adds hours.
      const before = await Event.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          hours: event.hours,
          volunteers: { $elemMatch: { user: userId, status: "registered" } },
        },
        {
          $set: {
            "volunteers.$.status": "approved",
            "volunteers.$.hoursAwarded": event.hours,
          },
        },
        { session },
      );

      if (!before) {
        const current = await Event.findOne({
          _id: id,
          deletedAt: null,
          "volunteers.user": userId,
        }).session(session);

        if (!current) {
          return { status: 404, body: { message: "Volunteer not found" } };
        }

        return {
          status: 200,
          body: { message: "Volunteer already approved", changed: false },
        };
      }

      await User.updateOne(
        { _id: userId },
        { $inc: { volunteerHours: event.hours } },
        { session },
      );

      return { status: 200, body: { message: "Volunteer approved", changed: true } };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const unapproveVolunteer = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const result = await inTransaction(async (session) => {
      // Only the request that flips approved -> registered subtracts hours.
      const before = await Event.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          volunteers: { $elemMatch: { user: userId, status: "approved" } },
        },
        {
          $set: { "volunteers.$.status": "registered" },
          $unset: { "volunteers.$.hoursAwarded": "" },
        },
        { session, returnDocument: "before" },
      );

      if (!before) {
        const current = await Event.findById(id).session(session);

        if (!current) {
          return { status: 404, body: { message: "Event not found" } };
        }

        if (current.deletedAt) {
          return { status: 410, body: { message: EVENT_DELETED } };
        }

        if (!current.volunteers.some((v) => v.user.equals(userId))) {
          return { status: 404, body: { message: "Volunteer not found" } };
        }

        return {
          status: 200,
          body: { message: "Volunteer is not approved", changed: false },
        };
      }

      const entry = before.volunteers.find((v) => v.user.equals(userId));
      const hours = entry.hoursAwarded ?? before.hours;

      await User.updateOne(
        { _id: userId },
        { $inc: { volunteerHours: -hours } },
        { session },
      );

      return {
        status: 200,
        body: { message: "Approval undone", changed: true },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRemovedVolunteers = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      deletedAt: null,
    }).populate({
      path: "removedVolunteers.user",
      select: "firstName lastName phone",
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(
      event.removedVolunteers
        .filter((removed) => removed.user)
        .sort((a, b) => b.removedAt - a.removedAt)
        .map((removed) => ({
          userId: removed.user._id,
          firstName: removed.user.firstName,
          lastName: removed.user.lastName,
          phone: removed.user.phone,
          gender: removed.gender,
          previousStatus: removed.previousStatus,
          removedAt: removed.removedAt,
        })),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeVolunteer = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id).session(session);

      if (!event) {
        return { status: 404, body: { message: "Event not found" } };
      }

      if (event.deletedAt) {
        return { status: 410, body: { message: EVENT_DELETED } };
      }

      const entry = event.volunteers.find((v) => v.user.equals(userId));

      if (!entry) {
        return event.removedVolunteers.some((r) => r.user.equals(userId))
          ? {
              status: 200,
              body: { message: "Volunteer already removed", changed: false },
            }
          : { status: 404, body: { message: "Volunteer not found" } };
      }

      const approved = entry.status === "approved";
      const hours = approved ? (entry.hoursAwarded ?? event.hours) : undefined;

      // The status filter guards against a concurrent approve/unapprove.
      const updated = await Event.updateOne(
        {
          _id: id,
          deletedAt: null,
          volunteers: { $elemMatch: { user: userId, status: entry.status } },
        },
        {
          $pull: { volunteers: { user: userId } },
          $push: {
            removedVolunteers: {
              user: userId,
              gender: entry.gender,
              previousStatus: entry.status,
              hoursAwarded: hours,
              removedAt: new Date(),
              removedBy: req.user._id,
            },
          },
        },
        { session },
      );

      if (updated.modifiedCount === 0) {
        return {
          status: 409,
          body: { message: "This volunteer was just updated. Try again." },
        };
      }

      if (approved) {
        await User.updateOne(
          { _id: userId },
          { $inc: { volunteerHours: -hours } },
          { session },
        );
      }

      return { status: 200, body: { message: "Volunteer removed", changed: true } };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admins may restore past the spot limit; the response flags it.
export const restoreVolunteer = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id).session(session);

      if (!event) {
        return { status: 404, body: { message: "Event not found" } };
      }

      if (event.deletedAt) {
        return { status: 410, body: { message: EVENT_DELETED } };
      }

      const removed = event.removedVolunteers.find((r) => r.user.equals(userId));

      if (!removed) {
        return event.volunteers.some((v) => v.user.equals(userId))
          ? {
              status: 200,
              body: { message: "Volunteer is already on this event", changed: false },
            }
          : { status: 404, body: { message: "Volunteer not found" } };
      }

      const userExists = await User.exists({ _id: userId }).session(session);

      if (!userExists) {
        return {
          status: 410,
          body: { message: "This volunteer deleted their account" },
        };
      }

      const approved = removed.previousStatus === "approved";
      const hours = approved ? (removed.hoursAwarded ?? event.hours) : undefined;

      const updated = await Event.updateOne(
        {
          _id: id,
          deletedAt: null,
          "removedVolunteers.user": userId,
          "volunteers.user": { $ne: userId },
        },
        {
          $pull: { removedVolunteers: { user: userId } },
          $push: {
            volunteers: {
              user: userId,
              gender: removed.gender,
              status: removed.previousStatus,
              hoursAwarded: hours,
            },
          },
        },
        { session },
      );

      if (updated.modifiedCount === 0) {
        return {
          status: 409,
          body: { message: "This volunteer was just updated. Try again." },
        };
      }

      if (approved) {
        await User.updateOne(
          { _id: userId },
          { $inc: { volunteerHours: hours } },
          { session },
        );
      }

      const sameGender = event.volunteers.filter((v) => v.gender === removed.gender);

      return {
        status: 200,
        body: {
          message: "Volunteer restored",
          changed: true,
          status: removed.previousStatus,
          overCapacity: sameGender.length + 1 > event[maxField(removed.gender)],
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const RECENTLY_DELETED_MS = 30 * 24 * 60 * 60 * 1000;

export const getDeletedEvents = async (req, res) => {
  try {
    const events = await Event.find({
      deletedAt: { $gte: new Date(Date.now() - RECENTLY_DELETED_MS) },
    }).sort({ deletedAt: -1 });
    const userId = req.user._id.toString();

    return res.json(
      events.map((event) => formatEventForUser(event, userId, req.user.gender)),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Events with approved volunteers can't be deleted, so deleting never has to
// touch anyone's volunteerHours.
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: null,
        "volunteers.status": { $ne: "approved" },
      },
      { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
    );

    if (event) {
      return res.json({ message: "Event deleted", changed: true });
    }

    const current = await Event.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (current.deletedAt) {
      return res.json({ message: "Event already deleted", changed: false });
    }

    return res.status(409).json({
      message: "Unapprove this event's volunteers before deleting it",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const restoreEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null }, $unset: { deletedBy: "" } },
    );

    if (event) {
      return res.json({ message: "Event restored", changed: true });
    }

    const exists = await Event.exists({ _id: req.params.id });

    if (!exists) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json({ message: "Event is not deleted", changed: false });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Reverses cancelRegistration. Same rules as registering, but calling it while
// already registered is a no-op and a taken spot is reported as a conflict.
export const undoCancelRegistration = async (req, res) => {
  try {
    const userId = req.user._id;
    const userGender = req.user.gender;

    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: null,
        date: { $gt: new Date() },
        "volunteers.user": { $ne: userId },
        ...hasSpotFor(userGender),
      },
      {
        $push: {
          volunteers: { user: userId, gender: userGender, status: "registered" },
        },
        $pull: { removedVolunteers: { user: userId } },
      },
      { returnDocument: "after" },
    );

    if (event) {
      return res.json(formatEventForUser(event, userId.toString(), userGender));
    }

    const current = await Event.findById(req.params.id);

    if (
      current &&
      !current.deletedAt &&
      current.volunteers.some((v) => v.user.equals(userId))
    ) {
      return res.json(formatEventForUser(current, userId.toString(), userGender));
    }

    const failure = await registerFailure(req.params.id, req.user);

    if (failure.message.startsWith("No spots left")) {
      return res.status(409).json({
        message: "Someone took your spot, so your registration couldn't be restored",
      });
    }

    return res.status(failure.status).json({ message: failure.message });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
