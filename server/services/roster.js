import Event from "../models/Event.js";
import { notifyLater } from "./push.js";

// Ten hours before an event the roster freezes: no new registrations, no
// waitlist joins, no promotions, and the waitlist is cleared. Cancellations
// are locked at the same moment (with the date-change exception).
export const LOCK_MS = 10 * 60 * 60 * 1000;

export const maxField = (gender) =>
  gender === "brother" ? "brothersMax" : "sistersMax";

export const countGender = (event, gender) =>
  event.volunteers.filter((v) => v.gender === gender).length;

export const isRosterOpen = (event, now = Date.now()) =>
  event.date.getTime() - LOCK_MS > now;

// Query part: the event is more than 10 hours away.
export const rosterOpenFilter = () => ({
  date: { $gt: new Date(Date.now() + LOCK_MS) },
});

const sizeOf = (field, gender) => ({
  $size: {
    $filter: {
      input: { $ifNull: [`$${field}`, []] },
      as: "entry",
      cond: { $eq: ["$$entry.gender", gender] },
    },
  },
});

// Aggregation expressions, used inside $expr so the check and the write are
// one atomic operation.
export const hasSpotExpr = (gender) => ({
  $lt: [sizeOf("volunteers", gender), `$${maxField(gender)}`],
});
export const isFullExpr = (gender) => ({
  $gte: [sizeOf("volunteers", gender), `$${maxField(gender)}`],
});
export const nobodyWaitingExpr = (gender) => ({
  $eq: [sizeOf("waitlist", gender), 0],
});
export const somebodyWaitingExpr = (gender) => ({
  $gt: [sizeOf("waitlist", gender), 0],
});

// Waitlisted people of one group, in queue order. Empty once the roster is
// frozen, whether or not the entries have been cleared yet.
export const waitingFor = (event, gender) =>
  isRosterOpen(event)
    ? (event.waitlist ?? []).filter((entry) => entry.gender === gender)
    : [];

// Empties the waitlist of an event that's inside the 10-hour window.
export const clearClosedWaitlist = (eventId) =>
  Event.updateOne(
    {
      _id: eventId,
      date: { $lte: new Date(Date.now() + LOCK_MS) },
      "waitlist.0": { $exists: true },
    },
    { $set: { waitlist: [] } },
  );

// Fills free spots from the waitlist, first come first served per group.
// Each promotion is one conditional update that only succeeds while the
// person is still first-in-line material (still waiting, not registered)
// and the group still has room, so concurrent calls can't over-fill or
// promote anyone twice. A failed attempt just re-reads and tries again.
export const promoteFromWaitlist = async (eventId) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const event = await Event.findOne({ _id: eventId, deletedAt: null });
    if (!event) return;

    if (!isRosterOpen(event)) {
      await clearClosedWaitlist(eventId);
      return;
    }

    const next = ["brother", "sister"]
      .map((gender) => waitingFor(event, gender)[0])
      .find(
        (entry) =>
          entry &&
          countGender(event, entry.gender) < event[maxField(entry.gender)],
      );

    if (!next) return;

    const now = new Date();
    const promoted = await Event.updateOne(
      {
        _id: eventId,
        deletedAt: null,
        ...rosterOpenFilter(),
        "waitlist.user": next.user,
        "volunteers.user": { $ne: next.user },
        $expr: hasSpotExpr(next.gender),
      },
      {
        $pull: { waitlist: { user: next.user } },
        $push: {
          volunteers: {
            user: next.user,
            gender: next.gender,
            status: "registered",
            registeredAt: now,
            promotedAt: now,
          },
        },
      },
    );

    if (promoted.modifiedCount === 1) {
      notifyLater([next.user], {
        title: "You got a spot!",
        body: `A spot opened up and you're now registered for ${event.name}.`,
        url: `/events/${event._id}`,
      });
    }
  }
};
