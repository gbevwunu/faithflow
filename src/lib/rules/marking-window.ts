import type { ChurchConfig, TeamRole } from "@/lib/config";
import { getServiceDate, minutesOfDay, toZonedDateTime, zonedTimeToInstant } from "./time";

/**
 * Phase of the service day, the same for every role:
 * - "open": before teamLockTime on the service day.
 * - "corrections": from teamLockTime until correctionEndTime on the service day.
 * - "closed": from correctionEndTime, and all day on any other day.
 */
export type MarkingState = "open" | "corrections" | "closed";

export interface MarkingWindow {
  /** Whether this role may mark or unmark right now. */
  allowed: boolean;
  state: MarkingState;
  /** When marking closes for this role; null when it is already closed for them. */
  closesAt: Date | null;
}

/** Whether a role may mark attendance at an instant, evaluated in the church's timezone. */
export function getMarkingWindow(
  now: Date,
  role: TeamRole,
  config: Pick<ChurchConfig, "timezone" | "schedule">,
): MarkingWindow {
  const { timezone, schedule } = config;
  const local = toZonedDateTime(now, timezone);
  if (local.weekday !== schedule.serviceDay) {
    return { allowed: false, state: "closed", closesAt: null };
  }

  const minutesNow = local.hour * 60 + local.minute;
  const state: MarkingState =
    minutesNow < minutesOfDay(schedule.teamLockTime)
      ? "open"
      : minutesNow < minutesOfDay(schedule.correctionEndTime)
        ? "corrections"
        : "closed";

  const allowed = state === "open" || (state === "corrections" && role === "admin");
  if (!allowed) {
    return { allowed, state, closesAt: null };
  }

  const closingTime = role === "admin" ? schedule.correctionEndTime : schedule.teamLockTime;
  const closesAt = zonedTimeToInstant(getServiceDate(now, config), closingTime, timezone);
  return { allowed, state, closesAt };
}
