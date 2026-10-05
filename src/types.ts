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

export type RemovedVolunteer = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender;
  previousStatus: "registered" | "approved";
  removedAt: string;
};
