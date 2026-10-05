import Event from "../models/Event.js";
import User from "../models/User.js";
import { inTransaction } from "../utils/transaction.js";
import { eventPageSchema } from "../validators/eventValidator.js";
import { ageOn, startOfTodayUtc } from "../validators/userValidator.js";

const EVENT_DELETED = "This event was deleted";
const NOT_STARTED = "Hours can only be approved once the event has started";

const CANCEL_LOCK_MS = 10 * 60 * 60 * 1000;

const maxField = (gender) => (gender === "brother" ? "brothersMax" : "sistersMax");

const countGender = (event, gender) =>
  event.volunteers.filter((v) => v.gender === gender).length;

// Built field by field so volunteer data, admin fields and anything added to
// the model later never reach non-admin clients by accident.
// People registered before the event's date last changed agreed to a
// different time, so the 10-hour cancellation lock doesn't apply to them.
const registeredBeforeDateChange = (event, entry) =>
  !!event.dateChangedAt &&
  (!entry.registeredAt || entry.registeredAt < event.dateChangedAt);

const formatEventForUser = (event, userId, userGender) => {
  const myEntry = event.volunteers.find((v) => v.user.toString() === userId);

  const response = {
    _id: event._id,
    name: event.name,
    date: event.date,
    location: event.location,
    description: event.description ?? "",
    hours: event.hours,
    brothersMax: event.brothersMax,
    sistersMax: event.sistersMax,
    deletedAt: event.deletedAt ?? null,
    brothersRegistered: countGender(event, "brother"),
    sistersRegistered: countGender(event, "sister"),
    myStatus: myEntry?.status ?? null,
    previousDate: event.previousDate ?? null,
    dateChangedAt: event.dateChangedAt ?? null,
    myCancelLockWaived:
      myEntry?.status === "registered" &&
      registeredBeforeDateChange(event, myEntry),
    // Your own counted hours once approved (partial-hour changes included).
    myHours:
      myEntry?.status === "approved"
        ? (myEntry.hoursAwarded ?? event.hours)
        : null,
  };

  // Registered volunteers see only their own group's contact.
  const contactKey = `${userGender}sContact`;
  const contact = event[contactKey];

  if (myEntry && contact?.name) {
    response[contactKey] = { name: contact.name, phone: contact.phone };
  }

  return response;
};

const encodeCursor = (event) =>
  Buffer.from(
    JSON.stringify({ d: event.date.toISOString(), i: event._id.toString() }),
  ).toString("base64url");

const decodeCursor = (cursor) => {
  try {
    const { d, i } = JSON.parse(Buffer.from(cursor, "base64url").toString());
    const date = new Date(d);
    if (Number.isNaN(date.getTime()) || !/^[a-f\d]{24}$/i.test(i)) return null;
    return { date, id: i };
  } catch {
    return null;
  }
};

// Without ?when= this returns every event as an array, as older app versions
// expect. With it, one page of a tab: upcoming soonest first, past most
// recent first. The cursor is the last (date, _id), so events added between
// pages cause no duplicates or gaps.
export const listEvents = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const format = (event) => formatEventForUser(event, userId, req.user.gender);

    if (req.query.when === undefined) {
      const events = await Event.find({ deletedAt: null }).sort({ date: 1 });
      return res.json(events.map(format));
    }

    const parsed = eventPageSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { when, limit, cursor } = parsed.data;
    const upcoming = when === "upcoming";
    const now = new Date();
    const base = {
      deletedAt: null,
      date: upcoming ? { $gt: now } : { $lte: now },
    };

    let after = {};
    if (cursor) {
      const position = decodeCursor(cursor);
      if (!position) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      const beyond = upcoming ? "$gt" : "$lt";
      after = {
        $or: [
          { date: { [beyond]: position.date } },
          { date: position.date, _id: { [beyond]: position.id } },
        ],
      };
    }

    const direction = upcoming ? 1 : -1;
    const [events, total] = await Promise.all([
      Event.find({ $and: [base, after] })
        .sort({ date: direction, _id: direction })
        .limit(limit + 1),
      Event.countDocuments(base),
    ]);

    const page = events.slice(0, limit);
    return res.json({
      items: page.map(format),
      nextCursor: events.length > limit ? encodeCursor(page.at(-1)) : null,
      total,
    });
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

// Admin: everything the edit form needs, including both contacts.
export const getEventForEdit = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, deletedAt: null });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const contact = (c) => (c?.name ? { name: c.name, phone: c.phone } : null);

    return res.json({
      _id: event._id,
      name: event.name,
      date: event.date,
      location: event.location,
      description: event.description ?? "",
      hours: event.hours,
      brothersMax: event.brothersMax,
      sistersMax: event.sistersMax,
      brothersContact: contact(event.brothersContact),
      sistersContact: contact(event.sistersContact),
      brothersRegistered: countGender(event, "brother"),
      sistersRegistered: countGender(event, "sister"),
      approvedCount: event.volunteers.filter((v) => v.status === "approved")
        .length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: edit every field. Registrations are never removed:
// - lowering a group's spots below its registrations is allowed, with a
//   warning; nobody is removed and no one new can register until there's room
// - setting a group to 0 while it has registrations is refused (its contact
//   would disappear for people relying on it)
// - moving the date keeps registrations and records the change; people who
//   registered before it may cancel inside the 10-hour lock
// - an event with approved hours can't move into the future
// - changing hours sets every approved volunteer's hours to the new value,
//   and their totals move by the difference, in the same transaction
// The whole edit runs in a transaction, so a registration arriving at the
// same time causes a retry rather than being lost.
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const input = req.body;

    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id).session(session);

      if (!event) {
        return { status: 404, body: { message: "Event not found" } };
      }

      if (event.deletedAt) {
        return { status: 410, body: { message: EVENT_DELETED } };
      }

      for (const gender of ["brother", "sister"]) {
        const registered = countGender(event, gender);
        if (input[maxField(gender)] === 0 && registered > 0) {
          return {
            status: 409,
            body: {
              message: `${registered} ${gender}${registered === 1 ? " is" : "s are"} registered. Remove them before setting ${gender}s needed to 0.`,
            },
          };
        }
      }

      const approved = event.volunteers.filter((v) => v.status === "approved");
      // Re-picking the same minute in the app can drop seconds, which isn't
      // a real move, so only a change of a minute or more counts.
      const dateChanged =
        Math.abs(input.date.getTime() - event.date.getTime()) >= 60 * 1000;

      if (dateChanged && approved.length > 0 && input.date > new Date()) {
        return {
          status: 409,
          body: {
            message:
              "Hours are already approved for this event, so it can't move to a future date",
          },
        };
      }

      const set = {
        name: input.name,
        date: input.date,
        location: input.location,
        hours: input.hours,
        brothersMax: input.brothersMax,
        sistersMax: input.sistersMax,
      };
      const unset = {};

      for (const key of ["brothersContact", "sistersContact"]) {
        const needed = input[key === "brothersContact" ? "brothersMax" : "sistersMax"] > 0;
        if (needed) set[key] = input[key];
        else unset[key] = "";
      }

      if (input.description) set.description = input.description;
      else unset.description = "";

      if (dateChanged) {
        set.previousDate = event.date;
        set.dateChangedAt = new Date();
      }

      const hoursChanged = input.hours !== event.hours;
      const resetHours = hoursChanged && approved.length > 0;
      if (resetHours) {
        set["volunteers.$[approved].hoursAwarded"] = input.hours;
        set["volunteers.$[approved].hoursResetAt"] = new Date();
      }

      const updated = await Event.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        {
          session,
          returnDocument: "after",
          ...(resetHours
            ? { arrayFilters: [{ "approved.status": "approved" }] }
            : {}),
        },
      );

      if (resetHours) {
        const changes = approved
          .map((v) => ({
            user: v.user,
            diff: input.hours - (v.hoursAwarded ?? event.hours),
          }))
          .filter((change) => change.diff !== 0);

        if (changes.length) {
          await User.bulkWrite(
            changes.map((change) => ({
              updateOne: {
                filter: { _id: change.user },
                update: { $inc: { volunteerHours: change.diff } },
              },
            })),
            { session },
          );
        }
      }

      const warnings = [];
      for (const gender of ["brother", "sister"]) {
        const registered = countGender(updated, gender);
        const max = updated[maxField(gender)];
        if (max > 0 && registered > max) {
          warnings.push(
            `${registered} ${gender}s registered for ${max} spots. Nobody was removed.`,
          );
        }
      }

      return {
        status: 200,
        body: {
          event: formatEventForUser(updated, req.user._id.toString(), req.user.gender),
          warnings,
          hoursUpdatedFor: resetHours ? approved.length : 0,
        },
      };
    });

    return res.status(result.status).json(result.body);
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
          volunteers: {
            user: userId,
            gender: userGender,
            status: "registered",
            registeredAt: new Date(),
          },
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

    // Inside the lock, but the date moved after they registered.
    if (
      current.date > new Date() &&
      registeredBeforeDateChange(current, volunteer)
    ) {
      const released = await Event.findOneAndUpdate(
        {
          _id: req.params.id,
          deletedAt: null,
          date: { $gt: new Date() },
          dateChangedAt: current.dateChangedAt,
          volunteers: { $elemMatch: { user: userId, status: "registered" } },
        },
        { $pull: { volunteers: { user: userId, status: "registered" } } },
        { returnDocument: "after" },
      );

      if (released) {
        return res.json(
          formatEventForUser(released, userId.toString(), req.user.gender),
        );
      }
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
      // Admin-only route, so the (otherwise hidden) date of birth is included.
      select: "firstName lastName phone gender +dateOfBirth",
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
          dateOfBirth: volunteer.user.dateOfBirth ?? null,
        })),
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const csvCell = (value) => {
  let text = String(value ?? "");
  // Spreadsheet apps run cells starting with these as formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const fileSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "event";

// Admin: the event's volunteers as CSV. Leaves the app, so it carries an
// under-18 flag rather than ages or dates of birth, and no contact details.
export const getVolunteersCsv = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      deletedAt: null,
    }).populate({
      path: "volunteers.user",
      select: "firstName lastName +dateOfBirth",
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const today = startOfTodayUtc();
    const rows = event.volunteers
      .filter((volunteer) => volunteer.user)
      .map((volunteer) => {
        const dob = volunteer.user.dateOfBirth;
        return [
          volunteer.user.firstName,
          volunteer.user.lastName,
          volunteer.gender === "brother" ? "Brother" : "Sister",
          volunteer.status === "approved" ? "Approved" : "Registered",
          dob ? (ageOn(dob, today) < 18 ? "Yes" : "No") : "Unknown",
        ];
      })
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

    const lines = [
      ["First name", "Last name", "Group", "Status", "Under 18"],
      ...rows,
    ].map((row) => row.map(csvCell).join(","));

    const day = event.date.toISOString().slice(0, 10);
    res.attachment(`${fileSlug(event.name)}-${day}-volunteers.csv`);
    res.type("text/csv; charset=utf-8");
    // The byte-order mark makes Excel read accented names correctly.
    return res.send(`﻿${lines.join("\r\n")}\r\n`);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveVolunteer = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id)
        .select("hours deletedAt date")
        .session(session);

      if (!event) {
        return { status: 404, body: { message: "Event not found" } };
      }

      if (event.deletedAt) {
        return { status: 410, body: { message: EVENT_DELETED } };
      }

      // Hours count for attending, so they can't be confirmed in advance.
      if (event.date > new Date()) {
        return { status: 400, body: { message: NOT_STARTED } };
      }

      // Only the request that flips registered -> approved adds hours.
      const before = await Event.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          date: { $lte: new Date() },
          hours: event.hours,
          volunteers: { $elemMatch: { user: userId, status: "registered" } },
        },
        {
          $set: {
            "volunteers.$.status": "approved",
            "volunteers.$.hoursAwarded": event.hours,
            "volunteers.$.approvedBy": req.user._id,
            "volunteers.$.approvedAt": new Date(),
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
          $unset: {
            "volunteers.$.hoursAwarded": "",
            "volunteers.$.approvedBy": "",
            "volunteers.$.approvedAt": "",
          },
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
              approvedBy: approved ? entry.approvedBy : undefined,
              approvedAt: approved ? entry.approvedAt : undefined,
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
              registeredAt: new Date(),
              hoursAwarded: hours,
              approvedBy: approved ? removed.approvedBy : undefined,
              approvedAt: approved ? removed.approvedAt : undefined,
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
          volunteers: {
            user: userId,
            gender: userGender,
            status: "registered",
            registeredAt: new Date(),
          },
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
