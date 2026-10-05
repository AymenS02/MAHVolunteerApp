// "1 hr", "1.5 hrs"
export const formatHours = (hours: number) =>
  `${hours} ${Math.abs(hours) === 1 ? "hr" : "hrs"}`;

// "+2 hrs", "−1.5 hrs"
export const formatSignedHours = (hours: number) =>
  `${hours > 0 ? "+" : "−"}${formatHours(Math.abs(hours))}`;

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
