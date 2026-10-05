import Event from "../models/Event.js";
import HourAdjustment from "../models/HourAdjustment.js";
import User from "../models/User.js";
import { buildHistory, buildSummary, roundHours } from "../services/hours.js";
import { inTransaction } from "../utils/transaction.js";

export const getMyHours = async (req, res) => {
  try {
    const { total, items } = await buildHistory(req.user._id);
    return res.json({ total, items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyHoursSummary = async (req, res) => {
  try {
    const summary = await buildSummary(req.user._id);
    return res.json({
      volunteer: { firstName: req.user.firstName, lastName: req.user.lastName },
      ...summary,
      generatedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: a volunteer's history plus the full audit trail of adjustments.
export const getUserHours = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "firstName lastName gender role volunteerHours +dateOfBirth",
    );

    if (!user) {
      return res.status(404).json({ message: "Volunteer not found" });
    }

    const { total, items, adjustments } = await buildHistory(user._id);
    const people = await User.find({
      _id: { $in: adjustments.map((a) => a.createdBy) },
    }).select("firstName lastName");
    const events = await Event.find({
      _id: { $in: adjustments.map((a) => a.event).filter(Boolean) },
    }).select("name");
    const nameOf = (list, id) => list.find((doc) => doc._id.equals(id));

    return res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        role: user.role,
        dateOfBirth: user.dateOfBirth ?? null,
      },
      total,
      items,
      audit: adjustments.map((a) => {
        const by = nameOf(people, a.createdBy);
        return {
          id: a._id,
          amount: a.amount,
          reason: a.reason,
          date: a.createdAt,
          by: by ? `${by.firstName} ${by.lastName}` : "Deleted admin",
          before: a.before,
          after: a.after,
          event: a.event
            ? {
                id: a.event,
                name: nameOf(events, a.event)?.name ?? "Deleted event",
                hoursBefore: a.eventHoursBefore,
                hoursAfter: a.eventHoursAfter,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: add or remove hours with a reason. With eventId it changes the
// hours counted for that event (e.g. left early); without it, it's a
// standalone correction. The user's total, the event entry and the audit
// record are written in one transaction.
export const createAdjustment = async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount, reason, eventId } = req.body;

    if (req.user._id.equals(userId)) {
      return res
        .status(403)
        .json({ message: "You can't adjust your own hours" });
    }

    const result = await inTransaction(async (session) => {
      const exists = await User.exists({ _id: userId }).session(session);

      if (!exists) {
        return { status: 404, body: { message: "Volunteer not found" } };
      }

      let eventHoursBefore;
      let eventHoursAfter;

      if (eventId) {
        const event = await Event.findOne({
          _id: eventId,
          volunteers: { $elemMatch: { user: userId, status: "approved" } },
        }).session(session);

        if (!event) {
          return {
            status: 400,
            body: { message: "This volunteer isn't approved for that event" },
          };
        }

        const entry = event.volunteers.find((v) => v.user.equals(userId));
        eventHoursBefore = entry.hoursAwarded ?? event.hours;
        eventHoursAfter = roundHours(eventHoursBefore + amount);

        if (eventHoursAfter < 0) {
          return {
            status: 409,
            body: { message: "That would make this event's hours negative" },
          };
        }

        // Conditional on the value just read, so a concurrent change can't
        // be overwritten.
        const updated = await Event.updateOne(
          {
            _id: eventId,
            volunteers: {
              $elemMatch: {
                user: userId,
                status: "approved",
                hoursAwarded:
                  entry.hoursAwarded === undefined
                    ? { $exists: false }
                    : entry.hoursAwarded,
              },
            },
          },
          { $set: { "volunteers.$.hoursAwarded": eventHoursAfter } },
          { session },
        );

        if (updated.modifiedCount === 0) {
          return {
            status: 409,
            body: { message: "These hours were just changed. Try again." },
          };
        }
      }

      // The total can't go below 0.
      const before = await User.findOneAndUpdate(
        {
          _id: userId,
          ...(amount < 0 ? { volunteerHours: { $gte: -amount } } : {}),
        },
        { $inc: { volunteerHours: amount } },
        { session, returnDocument: "before" },
      );

      if (!before) {
        return {
          status: 409,
          body: { message: "That would make their total negative" },
        };
      }

      const totalBefore = roundHours(before.volunteerHours ?? 0);
      const [adjustment] = await HourAdjustment.create(
        [
          {
            user: userId,
            event: eventId,
            amount,
            reason,
            createdBy: req.user._id,
            before: totalBefore,
            after: roundHours(totalBefore + amount),
            eventHoursBefore,
            eventHoursAfter,
          },
        ],
        { session },
      );

      return {
        status: 201,
        body: {
          message: "Hours adjusted",
          adjustment: {
            id: adjustment._id,
            amount,
            reason: adjustment.reason,
            before: adjustment.before,
            after: adjustment.after,
          },
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
