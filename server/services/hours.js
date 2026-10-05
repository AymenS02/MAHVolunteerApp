import mongoose from "mongoose";
import Event from "../models/Event.js";
import HourAdjustment from "../models/HourAdjustment.js";

// Hours are quarter-hour multiples, which add exactly. Legacy events may
// have other values, so totals are rounded to 2 decimals for display.
export const roundHours = (value) => Math.round(value * 100) / 100;

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// One row per event the user is approved on, with the hours counted now.
export const approvedEvents = (userId) =>
  Event.aggregate([
    { $match: { volunteers: { $elemMatch: { user: toObjectId(userId), status: "approved" } } } },
    { $unwind: "$volunteers" },
    { $match: { "volunteers.user": toObjectId(userId), "volunteers.status": "approved" } },
    {
      $project: {
        name: 1,
        date: 1,
        deletedAt: 1,
        eventHours: "$hours",
        hours: { $ifNull: ["$volunteers.hoursAwarded", "$hours"] },
        approvedAt: "$volunteers.approvedAt",
        hoursResetAt: "$volunteers.hoursResetAt",
      },
    },
    { $sort: { date: -1 } },
  ]);

const publicAdjustment = (adjustment) => ({
  id: adjustment._id,
  amount: adjustment.amount,
  reason: adjustment.reason,
  date: adjustment.createdAt,
});

// The explanation of a user's total: every approved event (with any partial-
// hour changes made since it was approved) plus standalone adjustments.
// `total` is the sum of `items` by construction; user.volunteerHours is kept
// equal to it by the atomic updates (checked by tests and reconcileHours.js).
export const buildHistory = async (userId) => {
  const [events, adjustments] = await Promise.all([
    approvedEvents(userId),
    HourAdjustment.find({ user: userId }).sort({ createdAt: -1 }).lean(),
  ]);

  const eventItems = events.map((event) => ({
    type: "event",
    eventId: event._id,
    name: event.name,
    date: event.date,
    hours: event.hours,
    eventHours: event.eventHours,
    // Only changes since the hours were last set (by approving, or by an
    // admin editing the event's hours) explain the current number.
    adjustments: adjustments
      .filter((a) => {
        const since = Math.max(
          event.approvedAt?.getTime() ?? 0,
          event.hoursResetAt?.getTime() ?? 0,
        );
        return a.event?.equals(event._id) && a.createdAt.getTime() >= since;
      })
      .map(publicAdjustment),
  }));

  const standaloneItems = adjustments
    .filter((a) => !a.event)
    .map((a) => ({ type: "adjustment", ...publicAdjustment(a) }));

  const items = [...eventItems, ...standaloneItems].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const total = roundHours(
    eventItems.reduce((sum, item) => sum + item.hours, 0) +
      standaloneItems.reduce((sum, item) => sum + item.amount, 0),
  );

  return { total, items, adjustments };
};

// What a student's school summary shows: approved events only, with each
// event's hours including partial-hour changes. Standalone adjustments are
// not events, so they're left out (and so is their effect on the total).
export const buildSummary = async (userId) => {
  const events = (await approvedEvents(userId))
    .filter((event) => !event.deletedAt)
    .map((event) => ({ name: event.name, date: event.date, hours: event.hours }));

  return {
    events,
    total: roundHours(events.reduce((sum, event) => sum + event.hours, 0)),
  };
};
