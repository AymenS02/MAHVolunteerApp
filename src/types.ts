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
};

export type EventVolunteer = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: Gender;
  status: "registered" | "approved";
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
