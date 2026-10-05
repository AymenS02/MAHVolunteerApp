export type Gender = "brother" | "sister";
export type Role = "volunteer" | "admin";

export type User = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender;
  role: Role;
  volunteerHours: number;
  highschoolStudent: boolean;
  notificationsEnabled?: boolean;
  // "YYYY-MM-DD" at UTC midnight as ISO. Missing on accounts created before
  // it was collected; those users are sent to /complete-profile.
  dateOfBirth?: string | null;
};

export type EventStatus = "registered" | "approved" | null;

export type Event = {
  _id: string;
  name: string;
  date: string;
  location: string;
  hours: number;
  brothersMax: number;
  sistersMax: number;
  brothersRegistered: number;
  sistersRegistered: number;
  myStatus: EventStatus;
  brothersContact?: { name: string; phone: string };
  sistersContact?: { name: string; phone: string };
  deletedAt?: string | null;
  // What to bring, where to meet. Empty string when not set.
  description?: string;
  // Set when an admin moved the event.
  previousDate?: string | null;
  dateChangedAt?: string | null;
  // You signed up before the date changed, so the 10-hour lock doesn't apply.
  myCancelLockWaived?: boolean;
  // Your own counted hours once approved; null otherwise.
  myHours?: number | null;
  // Waitlist counts per group; who is waiting is never shared.
  brothersWaitlisted?: number;
  sistersWaitlisted?: number;
  // Your place in your group's queue, or null if you're not waiting.
  myWaitlistPosition?: number | null;
  // Set when your registration came from the waitlist.
  myPromotedAt?: string | null;
  // False within 10 hours of the event: no sign-ups or waitlist.
  signupsOpen?: boolean;
};

export type EventPage = {
  items: Event[];
  nextCursor: string | null;
  total: number;
};

export type EventVolunteer = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender;
  status: "registered" | "approved";
  dateOfBirth: string | null;
};

export type HoursNote = {
  id: string;
  amount: number;
  reason: string;
  date: string;
};

// One line of a volunteer's hours history. Event lines count `hours`
// (the event's `eventHours` plus any partial-hour `adjustments`);
// adjustment lines count `amount`.
export type HoursItem =
  | {
      type: "event";
      eventId: string;
      name: string;
      date: string;
      hours: number;
      eventHours: number;
      adjustments: HoursNote[];
    }
  | ({ type: "adjustment" } & HoursNote);

export type HoursHistory = { total: number; items: HoursItem[] };

export type AdjustmentAudit = {
  id: string;
  amount: number;
  reason: string;
  date: string;
  by: string;
  before: number;
  after: number;
  event: {
    id: string;
    name: string;
    hoursBefore: number;
    hoursAfter: number;
  } | null;
};

export type VolunteerHours = HoursHistory & {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    role: Role;
    dateOfBirth: string | null;
  };
  audit: AdjustmentAudit[];
};

// Admin view of an event's waitlist, in queue order per group.
export type WaitlistEntry = {
  userId: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  position: number;
  joinedAt: string;
  dateOfBirth: string | null;
};

// A message admins sent to an event's volunteers. Admins also get who sent
// it and how many people it went to.
export type EventMessage = {
  id: string;
  body: string;
  createdAt: string;
  sentBy?: string;
  recipientCount?: number;
  includeWaitlist?: boolean;
};

export type RemovedVolunteer = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender;
  previousStatus: "registered" | "approved";
  removedAt: string;
};
