import { z } from "zod";

export const createUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  gender: z.enum(["brother", "sister"]),
  highschoolStudent: z.boolean().optional(),
});
