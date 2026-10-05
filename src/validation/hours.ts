import { z } from "zod";

// Mirrors hourAdjustmentSchema in server/validators/userValidator.js.
// `amount` is typed as text and the direction is chosen separately.
export const adjustmentFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter the number of hours")
    .transform(Number)
    .pipe(
      z
        .number({ error: "Enter a number, like 1.5" })
        .positive("Enter more than 0 hours")
        .max(100, "Adjustments can't be more than 100 hours")
        .multipleOf(0.25, "Use quarter hours, like 1.5 or 0.25"),
    ),
  reason: z
    .string()
    .trim()
    .min(3, "A reason is required (at least 3 characters)")
    .max(500, "Reason must be 500 characters or fewer"),
});
