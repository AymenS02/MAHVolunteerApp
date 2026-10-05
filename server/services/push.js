import { Expo } from "expo-server-sdk";
import PushTicket from "../models/PushTicket.js";
import PushToken from "../models/PushToken.js";
import User from "../models/User.js";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

// How messages and receipt lookups reach Expo. Tests swap these for fakes.
const expoTransport = {
  async send(messages) {
    const tickets = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets;
  },
  async receipts(ids) {
    const receipts = {};
    for (const chunk of expo.chunkPushNotificationReceiptIds(ids)) {
      Object.assign(receipts, await expo.getPushNotificationReceiptsAsync(chunk));
    }
    return receipts;
  },
};

let transport = expoTransport;
export const setPushTransport = (next) => {
  transport = next ?? expoTransport;
};

export const isPushToken = (token) => Expo.isExpoPushToken(token);

// Sends one notification to every device of each user, skipping users who
// turned notifications off. Never throws: a failed push must not fail the
// action that caused it.
export const notifyUsers = async (userIds, { title, body, url }) => {
  try {
    if (!userIds.length) return { sent: 0 };

    const users = await User.find({
      _id: { $in: userIds },
      notificationsEnabled: { $ne: false },
    }).select("_id");
    const tokens = await PushToken.find({
      user: { $in: users.map((user) => user._id) },
    });
    const messages = tokens
      .filter((t) => isPushToken(t.token))
      .map((t) => ({
        to: t.token,
        title,
        body,
        sound: "default",
        channelId: "default",
        ...(url ? { data: { url } } : {}),
      }));

    if (!messages.length) return { sent: 0 };

    // Tickets come back in the same order as the messages.
    const tickets = await transport.send(messages);
    const dead = [];
    const pending = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === "ok") {
        pending.push({ ticketId: ticket.id, token: messages[i].to });
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        dead.push(messages[i].to);
      }
    });

    if (dead.length) await PushToken.deleteMany({ token: { $in: dead } });
    if (pending.length) await PushTicket.insertMany(pending, { ordered: false });

    return { sent: messages.length };
  } catch (error) {
    console.error("[push] send failed:", error.message);
    return { sent: 0, error };
  }
};

// Fire-and-forget version for request handlers, so the response doesn't wait
// on Expo. Tests await `settlePush()` to see the result.
const inFlight = new Set();
export const notifyLater = (userIds, message) => {
  const promise = notifyUsers(userIds, message).finally(() =>
    inFlight.delete(promise),
  );
  inFlight.add(promise);
};
export const settlePush = () => Promise.all([...inFlight]);

// Expo reports devices that uninstalled the app in delivery receipts, about
// 15 minutes after sending. Their tokens are deleted.
export const checkReceipts = async (now = new Date()) => {
  const due = await PushTicket.find({
    createdAt: { $lte: new Date(now.getTime() - 15 * 60 * 1000) },
  }).limit(1000);
  if (!due.length) return { checked: 0, removed: 0 };

  const receipts = await transport.receipts(due.map((t) => t.ticketId));
  const dead = due
    .filter((t) => receipts[t.ticketId]?.details?.error === "DeviceNotRegistered")
    .map((t) => t.token);

  if (dead.length) await PushToken.deleteMany({ token: { $in: dead } });
  // Tickets without a receipt yet are retried next run (until they expire).
  await PushTicket.deleteMany({
    ticketId: { $in: due.filter((t) => receipts[t.ticketId]).map((t) => t.ticketId) },
  });

  return { checked: due.length, removed: dead.length };
};
