import { VolunteerEvent } from "@/types";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export const getStats = (events: VolunteerEvent[]) => {
  const completed = events.filter((e) => e.attended);
  return {
    totalHours: completed.reduce((sum, e) => sum + e.hours, 0),
    eventsCompleted: completed.length,
  };
};

export const splitEvents = (events: VolunteerEvent[]) => {
  const now = new Date();
  const time = (e: VolunteerEvent) => new Date(e.date).getTime();
  const future = events.filter((e) => new Date(e.date) >= now);

  return {
    registered: future
      .filter((e) => e.registered)
      .sort((a, b) => time(a) - time(b)),
    upcoming: future
      .filter((e) => !e.registered)
      .sort((a, b) => time(a) - time(b)),
    past: events
      .filter((e) => new Date(e.date) < now && e.attended)
      .sort((a, b) => time(b) - time(a)),
  };
};
