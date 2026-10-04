import { Event } from "@/types";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export const getStats = (events: Event[]) => ({
  totalHours: events.reduce((sum, event) => sum + (event.myStatus === "approved" ? event.hours : 0), 0),
  eventsCompleted: events.filter((event) => event.myStatus === "approved").length,
});

export const splitEvents = (events: Event[]) => {
  const time = (event: Event) => new Date(event.date).getTime();
  return {
    registered: events
      .filter((event) => event.myStatus === "registered")
      .sort((a, b) => time(a) - time(b)),
    upcoming: events
      .filter((event) => new Date(event.date).getTime() > 0)
      .sort((a, b) => time(a) - time(b)),
    past: events
      .filter((event) => new Date(event.date).getTime() <= 0)
      .sort((a, b) => time(b) - time(a)),
  };
};
