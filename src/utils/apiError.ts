import { isAxiosError } from "axios";

// True when the request never got an answer (offline, timeout) or the server
// failed, so trying again could work.
export const isRetryable = (error: unknown) =>
  isAxiosError(error) &&
  (!error.response || error.response.status >= 500);

export const apiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "You're offline. Check your connection and try again.";
    }

    const message = (error.response.data as { message?: string } | undefined)
      ?.message;

    if (message) {
      return message;
    }
  }

  return fallback;
};
