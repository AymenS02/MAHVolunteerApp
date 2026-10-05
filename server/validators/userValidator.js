import { z } from "zod";

export const MIN_AGE = 12;
export const MAX_AGE = 100;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

// Whole years between two UTC-midnight dates.
export const ageOn = (dateOfBirth, today) => {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      today.getUTCDate() < dateOfBirth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
};

// Accepts "YYYY-MM-DD" (a calendar day, no time or timezone) and produces a
// Date at UTC midnight of that day, so no timezone can shift it.
export const dateOfBirthSchema = z
  .string({ error: "Date of birth is required" })
  .regex(DATE_ONLY, "Date of birth must look like 2008-03-14")
  .transform((value, ctx) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Date.UTC rolls 2010-02-30 over to March 2; a real date round-trips.
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      ctx.addIssue({ code: "custom", message: "Enter a real date of birth" });
      return z.NEVER;
    }

    const today = startOfTodayUtc();

    if (date >= today) {
      ctx.addIssue({ code: "custom", message: "Date of birth must be in the past" });
      return z.NEVER;
    }

    const age = ageOn(date, today);

    if (age < MIN_AGE) {
      ctx.addIssue({
        code: "custom",
        message: `You must be at least ${MIN_AGE} years old`,
      });
      return z.NEVER;
    }

    if (age >= MAX_AGE) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date of birth" });
      return z.NEVER;
    }

    return date;
  });

export const setDateOfBirthSchema = z.object({ dateOfBirth: dateOfBirthSchema });

// Shared by registration and profile editing so the rules can't drift apart.
const firstNameSchema = z
  .string()
  .trim()
  .min(2, "First name must be at least 2 characters")
  .max(50, "First name must be 50 characters or fewer");
const lastNameSchema = z
  .string()
  .trim()
  .min(2, "Last name must be at least 2 characters")
  .max(50, "Last name must be 50 characters or fewer");
const phoneSchema = z
  .string()
  .trim()
  .min(10, "Phone number must be at least 10 digits")
  .max(20, "Phone number must be 20 characters or fewer");
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(200, "Password must be 200 characters or fewer")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter");

export const createUserSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  phone: phoneSchema,
  gender: z.enum(["brother", "sister"]),
  highschoolStudent: z.boolean().optional(),
  dateOfBirth: dateOfBirthSchema,
});

// Strict: role, email, volunteerHours, dateOfBirth etc. are rejected rather
// than silently ignored, so a client can't think it changed them.
export const updateProfileSchema = z.strictObject({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  phone: phoneSchema,
});

export const hourAdjustmentSchema = z.strictObject({
  amount: z
    .number({ error: "Amount is required" })
    .min(-100, "Adjustments can't be more than 100 hours")
    .max(100, "Adjustments can't be more than 100 hours")
    .multipleOf(0.25, "Use quarter hours, like 1.5 or 0.25")
    .refine((value) => value !== 0, "Amount can't be 0"),
  reason: z
    .string({ error: "A reason is required" })
    .trim()
    .min(3, "A reason is required (at least 3 characters)")
    .max(500, "Reason must be 500 characters or fewer"),
  eventId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Unknown event")
    .optional(),
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required")
      .max(200),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export const pushTokenSchema = z.strictObject({
  token: z.string().min(1).max(200),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export const notificationsSchema = z.strictObject({
  enabled: z.boolean({ error: "enabled must be true or false" }),
});
