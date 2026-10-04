import type { ChurchConfig, Weekday } from "@/lib/config";
import type { IsoDate } from "@/lib/data";

export interface ZonedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock date, time and weekday of an instant in the given IANA timezone. */
export function toZonedDateTime(instant: Date, timeZone: string): ZonedDateTime {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: String(parts.weekday).toLowerCase() as Weekday,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds the zone is ahead of UTC at the given instant. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = toZonedDateTime(new Date(instantMs), timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - (instantMs - (((instantMs % 1000) + 1000) % 1000));
}

/**
 * The instant at which the wall clock in the given timezone reads the given local date
 * and "HH:mm" time. Handles daylight saving changes: a time repeated when clocks fall back
 * resolves to its first occurrence, and a time skipped when clocks spring forward is moved
 * forward by the length of the gap (02:30 on a spring-forward day becomes 03:30).
 */
export function zonedTimeToInstant(date: IsoDate, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year ?? NaN, (month ?? NaN) - 1, day ?? NaN, hour, minute);

  // Offsets a day either side bracket any daylight saving change on this date.
  const offsetBefore = zoneOffsetMs(wallClockAsUtc - DAY_MS, timeZone);
  const offsetAfter = zoneOffsetMs(wallClockAsUtc + DAY_MS, timeZone);
  const candidates = [wallClockAsUtc - offsetBefore, wallClockAsUtc - offsetAfter];
  const valid = candidates.filter(
    (instant) => zoneOffsetMs(instant, timeZone) === wallClockAsUtc - instant,
  );
  return new Date(valid.length > 0 ? Math.min(...valid) : wallClockAsUtc - offsetBefore);
}

/** Parses "HH:mm" into minutes after midnight. */
export function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** The church's local calendar date for an instant, as YYYY-MM-DD. */
export function getServiceDate(now: Date, config: Pick<ChurchConfig, "timezone">): IsoDate {
  const { year, month, day } = toZonedDateTime(now, config.timezone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAYS: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Shifts a YYYY-MM-DD calendar date by whole days. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? NaN, (month ?? NaN) - 1, (day ?? NaN) + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * The church's most recent service date as of an instant, in its local timezone:
 * today on the service day, otherwise the last service day before today.
 */
export function getLatestServiceDate(
  now: Date,
  config: Pick<ChurchConfig, "timezone" | "schedule">,
): IsoDate {
  const today = getServiceDate(now, config);
  const weekday = toZonedDateTime(now, config.timezone).weekday;
  const daysSince =
    (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(config.schedule.serviceDay) + 7) % 7;
  return addDays(today, -daysSince);
}
