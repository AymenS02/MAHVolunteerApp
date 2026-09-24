export type VolunteerEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string; // ISO string
  hours: number;
  registered: boolean;
  attended: boolean;
};

export type User = {
  name: string;
  email: string;
  phone: string;
};
