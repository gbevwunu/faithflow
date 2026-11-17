import type { IsoDate } from "@/lib/data";

/** "17:00" -> "5:00 PM". */
export function formatTimeOfDay(time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** An instant as a clock time in the given timezone, e.g. "10:42 AM". */
export function formatClockTime(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(instant))
    .replace(/\u202f/g, " ");
}

/** "2026-10-04" -> "Sun, Oct 4". The date is a calendar date, so no timezone applies. */
export function formatServiceDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "2026-09-27" -> "Sep 27". */
export function formatMonthDay(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "2026-11-16" -> "November 16, 2026". */
export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Remaining time as "2h 14m", "14m" or "less than a minute". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes === 0) return "less than a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Up to two initials from a first and last name. */
export function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

/** Words left out of a church's initials, so "The NewBreed Church" is "NB", not "TNC". */
const INITIALS_SKIPPED_WORDS: ReadonlySet<string> = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "church",
]);

/**
 * Up to two initials for a church's display name, for its mark when it has no logo. Two
 * distinctive words give their first letters ("Grace Chapel" is "GC"); a single word gives its
 * capitals ("NewBreed" is "NB") or its first letter.
 */
export function churchInitials(displayName: string): string {
  const words = displayName
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const distinctive = words.filter((word) => !INITIALS_SKIPPED_WORDS.has(word.toLowerCase()));
  const chosen = distinctive.length > 0 ? distinctive : words;

  const [first = "", second] = chosen;
  if (second !== undefined) return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  const capitals = first.match(/\p{Lu}/gu) ?? [];
  return capitals.length >= 2 ? capitals.slice(0, 2).join("") : first.charAt(0).toUpperCase();
}
