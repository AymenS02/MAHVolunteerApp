import { z } from "zod";

// Only checks shape; a malformed email simply fails as "Invalid email or password".
export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});
