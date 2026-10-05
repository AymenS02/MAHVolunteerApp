import mongoose from "mongoose";

// Expo's ticket for each sent notification, kept until its delivery receipt
// is checked (about 15 minutes later). Expo drops receipts after 24 hours.
const pushTicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

export default mongoose.model("PushTicket", pushTicketSchema);
