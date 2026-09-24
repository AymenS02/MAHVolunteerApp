import { User, VolunteerEvent } from "@/types";

export const mockUser: User = {
  name: "Aymen",
  email: "aymen@example.com",
  phone: "(555) 123-4567",
};

export const mockEvents: VolunteerEvent[] = [
  {
    id: "1",
    title: "Youth Night Setup",
    description: "Help set up chairs, tables, and decorations.",
    location: "MAH Masjid",
    date: "2026-10-05T17:00:00",
    hours: 2,
    registered: true,
    attended: false,
  },
  {
    id: "2",
    title: "Food Drive",
    description: "Sort and pack food donations for local families.",
    location: "MAH Community Hall",
    date: "2026-10-20T10:00:00",
    hours: 4,
    registered: false,
    attended: false,
  },
  {
    id: "3",
    title: "Masjid Cleanup Day",
    description: "Deep clean the prayer hall and grounds.",
    location: "MAH Masjid",
    date: "2026-11-02T09:00:00",
    hours: 3,
    registered: false,
    attended: false,
  },
  {
    id: "4",
    title: "BBQ Night",
    description: "Grill, serve, and clean up at the youth BBQ.",
    location: "MAH Backyard",
    date: "2026-09-05T18:00:00",
    hours: 3,
    registered: true,
    attended: true,
  },
  {
    id: "5",
    title: "Ramadan Prep Drive",
    description: "Prepare care packages for the community.",
    location: "MAH Community Hall",
    date: "2026-08-15T11:00:00",
    hours: 4,
    registered: true,
    attended: true,
  },
];
