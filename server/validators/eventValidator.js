import { z } from "zod";

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1).max(30),
});

const spots = z
  .number()
  .int()
  .min(0)
  .max(500, "Spots per group can't be more than 500");

// Used for both creating and editing an event.
export const createEventSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(120, "Name must be 120 characters or fewer"),
    // Past dates are allowed so admins can log events after the fact.
    date: z.coerce
      .date()
      .refine(
        (date) => date.getTime() <= Date.now() + TWO_YEARS_MS,
        "Date must be within the next 2 years",
      ),
    location: z
      .string()
      .trim()
      .min(1, "Location is required")
      .max(200, "Location must be 200 characters or fewer"),
    // Quarter hours add up exactly; amounts like 0.1 don't in floating point.
    hours: z
      .number()
      .positive("Hours must be greater than 0")
      .max(24, "Hours can't be more than 24")
      .multipleOf(0.25, "Hours must be in quarter hours, like 1.5 or 2.25"),
    description: z
      .string()
      .trim()
      .max(2000, "Details must be 2000 characters or fewer")
      .optional(),
    brothersMax: spots,
    sistersMax: spots,
    brothersContact: contactSchema.optional(),
    sistersContact: contactSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.brothersMax > 0 && !data.brothersContact) {
      ctx.addIssue({
        code: "custom",
        path: ["brothersContact"],
        message: "Brothers contact is required when brothers needed is greater than 0",
      });
    }

    if (data.sistersMax > 0 && !data.sistersContact) {
      ctx.addIssue({
        code: "custom",
        path: ["sistersContact"],
        message: "Sisters contact is required when sisters needed is greater than 0",
      });
    }
  });

// GET /events?when=upcoming|past&limit=20&cursor=...
export const eventPageSchema = z.object({
  when: z.enum(["upcoming", "past"], { error: "when must be upcoming or past" }),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
