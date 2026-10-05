import Event from "../models/Event.js";
import NotificationLog from "../models/NotificationLog.js";
import Outbox from "../models/Outbox.js";
import { checkReceipts, notifyLater, notifyUsers } from "./push.js";
import { LOCK_MS, waitingFor } from "./roster.js";

const HOUR = 60 * 60 * 1000;
// Edits and deletions wait this long, so quick follow-up edits are merged
// and an Undo of a deletion sends nothing.
export const OUTBOX_DELAY_MS = 2 * 60 * 1000;

// Times in messages use EVENT_TIMEZONE (e.g. "America/Toronto"), since the
// server can't know each phone's timezone. Without it, the server's own.
const formatWhen = (date) =>
  date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.EVENT_TIMEZONE || undefined,
  });

const formatHours = (hours) => `${hours} ${Math.abs(hours) === 1 ? "hr" : "hrs"}`;
const eventUrl = (event) => `/events/${event._id}`;

// Registered and approved volunteers.
const signedUp = (event) => event.volunteers.map((v) => v.user);
const approvedOnly = (event) =>
  event.volunteers.filter((v) => v.status === "approved").map((v) => v.user);
const waiting = (event) =>
  [...waitingFor(event, "brother"), ...waitingFor(event, "sister")].map((w) => w.user);

// Records each (user, event, kind, key) once; returns the users this call
// claimed. Duplicate-key errors mean someone else already sent it.
const claim = async (userIds, eventId, kind, key) => {
  const claimed = [];
  for (const user of userIds) {
    try {
      await NotificationLog.create({ user, event: eventId, kind, key });
      claimed.push(user);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return claimed;
};

// --- Sent immediately (from request handlers) ---

export const notifyApproved = (userId, event, hours) =>
  notifyLater([userId], {
    title: "Hours approved",
    body: `+${formatHours(hours)} for ${event.name}.`,
    url: eventUrl(event),
  });

export const notifyAdjusted = (userId, amount, reason) =>
  notifyLater([userId], {
    title: "Your hours were adjusted",
    body: `${amount > 0 ? "+" : "−"}${formatHours(Math.abs(amount))} · ${reason}`,
    url: "/(tabs)/profile",
  });

export const notifyEventMessage = (userIds, event, body) =>
  notifyLater(userIds, {
    title: `Message about ${event.name}`,
    body,
    url: eventUrl(event),
  });

// --- Queued (see Outbox) ---

// `before` is the event's date, location and hours before this edit. If an
// entry is already pending, its older snapshot is kept.
export const queueEventChanged = async (eventId, before, now = new Date()) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await Outbox.updateOne(
        { kind: "eventChanged", event: eventId, open: true },
        {
          $setOnInsert: { snapshot: before },
          $set: { sendAfter: new Date(now.getTime() + OUTBOX_DELAY_MS) },
        },
        { upsert: true },
      );
      return;
    } catch (error) {
      // Two edits racing to create the entry: retry and merge.
      if (error.code !== 11000) throw error;
    }
  }
};

export const queueEventDeleted = (eventId, deletedAt, now = new Date()) =>
  Outbox.updateOne(
    { kind: "eventDeleted", event: eventId, open: true },
    {
      $set: {
        snapshot: { deletedAt },
        sendAfter: new Date(now.getTime() + OUTBOX_DELAY_MS),
      },
    },
    { upsert: true },
  );

export const queueEventRestored = (eventId, deletedAt, now = new Date()) =>
  Outbox.create({
    kind: "eventRestored",
    event: eventId,
    snapshot: { deletedAt },
    sendAfter: now,
  });

const outboxHandlers = {
  async eventChanged(job) {
    const event = await Event.findById(job.event);
    if (!event || event.deletedAt) return;

    const before = job.snapshot;
    const moved =
      Math.abs(new Date(before.date).getTime() - event.date.getTime()) >= 60 * 1000;
    const relocated = before.location !== event.location;

    // Only the net change: editing something back sends nothing.
    if (moved || relocated) {
      const lines = [
        moved ? `New time: ${formatWhen(event.date)}.` : null,
        relocated ? `New location: ${event.location}.` : null,
      ].filter(Boolean);
      await notifyUsers([...signedUp(event), ...waiting(event)], {
        title: `${event.name} changed`,
        body: lines.join(" "),
        url: eventUrl(event),
      });
    }

    if (before.hours !== event.hours) {
      await notifyUsers(approvedOnly(event), {
        title: "Hours updated",
        body: `Your hours for ${event.name} are now ${formatHours(event.hours)}.`,
        url: eventUrl(event),
      });
    }
  },

  async eventDeleted(job) {
    const event = await Event.findById(job.event);
    const deletedAt = new Date(job.snapshot.deletedAt);
    // Restored in the meantime (Undo), or deleted again later: nothing to say.
    if (!event?.deletedAt || event.deletedAt.getTime() !== deletedAt.getTime()) {
      return;
    }

    const users = await claim(
      [...signedUp(event), ...(event.waitlist ?? []).map((w) => w.user)],
      event._id,
      "cancelled",
      deletedAt.toISOString(),
    );
    await notifyUsers(users, {
      title: `${event.name} was cancelled`,
      body: "The organizers cancelled this event.",
    });
  },

  async eventRestored(job) {
    const event = await Event.findById(job.event);
    if (!event || event.deletedAt) return;

    const key = new Date(job.snapshot.deletedAt).toISOString();
    const told = await NotificationLog.find({
      event: event._id,
      kind: "cancelled",
      key,
    }).select("user");
    const users = await claim(
      told.map((log) => log.user),
      event._id,
      "restored",
      key,
    );
    await notifyUsers(users, {
      title: `${event.name} is back on`,
      body: `${formatWhen(event.date)} at ${event.location}.`,
      url: eventUrl(event),
    });
  },
};

// --- Jobs (run every minute by the scheduler) ---

// About a day before. Keyed by the event date, so a moved event gets a new
// reminder. Window ends where the cancel nudge window starts.
export const sendReminders = async (now = new Date()) => {
  const events = await Event.find({
    deletedAt: null,
    date: {
      $gt: new Date(now.getTime() + 12 * HOUR),
      $lte: new Date(now.getTime() + 24 * HOUR),
    },
  });

  let sent = 0;
  for (const event of events) {
    const users = await claim(signedUp(event), event._id, "reminder", event.date.toISOString());
    if (users.length) {
      await notifyUsers(users, {
        title: `Reminder: ${event.name}`,
        body: `${formatWhen(event.date)} at ${event.location}.`,
        url: eventUrl(event),
      });
      sent += users.length;
    }
  }
  return { sent };
};

// Two hours before the 10-hour cancel lock, to people who can still cancel.
export const sendCancelNudges = async (now = new Date()) => {
  const events = await Event.find({
    deletedAt: null,
    date: {
      $gt: new Date(now.getTime() + LOCK_MS),
      $lte: new Date(now.getTime() + LOCK_MS + 2 * HOUR),
    },
  });

  let sent = 0;
  for (const event of events) {
    const registered = event.volunteers
      .filter((v) => v.status === "registered")
      .map((v) => v.user);
    const users = await claim(registered, event._id, "cancelNudge", event.date.toISOString());
    if (users.length) {
      await notifyUsers(users, {
        title: `Still coming to ${event.name}?`,
        body: `If you can't make it, cancel before ${formatWhen(
          new Date(event.date.getTime() - LOCK_MS),
        )} so someone else can take your spot.`,
        url: eventUrl(event),
      });
      sent += users.length;
    }
  }
  return { sent };
};

// Claims due entries one at a time (atomic), so two servers never send the
// same one.
export const processOutbox = async (now = new Date()) => {
  let processed = 0;
  for (;;) {
    const job = await Outbox.findOneAndUpdate(
      { open: true, sendAfter: { $lte: now } },
      { $unset: { open: "" } },
      { sort: { sendAfter: 1 }, returnDocument: "after" },
    );
    if (!job) break;

    try {
      await outboxHandlers[job.kind](job);
    } catch (error) {
      console.error(`[outbox] ${job.kind} failed:`, error.message);
    }
    await Outbox.deleteOne({ _id: job._id });
    processed++;
  }
  return { processed };
};

export const runJobs = async (now = new Date()) => ({
  reminders: await sendReminders(now),
  nudges: await sendCancelNudges(now),
  outbox: await processOutbox(now),
  receipts: await checkReceipts(now),
});

// Runs the jobs every minute. Overlapping runs are skipped.
export const startScheduler = (intervalMs = 60 * 1000) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runJobs();
    } catch (error) {
      console.error("[jobs] failed:", error.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
};
