// Dates of birth are calendar days. The server stores them at UTC midnight,
// so always read them back with UTC parts, or a phone west of UTC would show
// the day before.

export const MIN_AGE = 13;
export const MAX_AGE = 100;

// "YYYY-MM-DD" from the day the user picked, using local parts.
// (toISOString() would shift it across midnight in some timezones.)
export const toDateOnly = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export const formatDateOfBirth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export const getAge = (iso: string, today = new Date()) => {
  const dob = new Date(iso);
  let age = today.getFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getUTCMonth() ||
    (today.getMonth() === dob.getUTCMonth() &&
      today.getDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
};

// Bounds for the picker so out-of-range ages can't be chosen.
export const pickerBounds = () => {
  const today = new Date();
  const yearsAgo = (years: number, days = 0) =>
    new Date(
      today.getFullYear() - years,
      today.getMonth(),
      today.getDate() + days,
    );
  return {
    maximumDate: yearsAgo(MIN_AGE),
    minimumDate: yearsAgo(MAX_AGE, 1),
  };
};

// Where the picker opens before anything is chosen.
export const DEFAULT_PICKER_DATE = new Date(2010, 0, 1);
