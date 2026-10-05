import { z } from "zod";

// Mirrors server/validators/userValidator.js. The server is the source of
// truth (and is tested); these give instant feedback before submitting.

const password = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter");

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be 50 characters or fewer"),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be 50 characters or fewer"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number must be 20 characters or fewer")
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Phone number must be at least 10 digits",
    ),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.confirmPassword === data.newPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

// First message per field, for showing under each input.
export const fieldErrors = <T extends string>(
  error: z.ZodError,
): Partial<Record<T, string>> => {
  const errors: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as T;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
};
