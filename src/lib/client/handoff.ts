// Short-lived values handed between screens in this browser tab only. Names typed by the
// volunteer stay out of URLs, so they never reach server logs or browser history.

const PREFILL_KEY = "ff-newcomer-prefill";
const FLASH_KEY = "ff-attendance-flash";

export interface NewcomerPrefill {
  firstName: string;
  lastName: string;
}

export interface AttendanceFlash {
  message: string;
  /** Search text to apply so the person is visible straight away. */
  query: string;
}

function put(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, blocked); the handoff is a convenience.
  }
}

function take<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

const isRecordOfStrings =
  <K extends string>(...keys: K[]) =>
  (value: unknown): value is Record<K, string> =>
    typeof value === "object" &&
    value !== null &&
    keys.every((k) => typeof (value as Record<string, unknown>)[k] === "string");

export const saveNewcomerPrefill = (prefill: NewcomerPrefill) => put(PREFILL_KEY, prefill);
export const takeNewcomerPrefill = () =>
  take(PREFILL_KEY, isRecordOfStrings("firstName", "lastName"));

export const saveAttendanceFlash = (flash: AttendanceFlash) => put(FLASH_KEY, flash);
export const takeAttendanceFlash = () => take(FLASH_KEY, isRecordOfStrings("message", "query"));
