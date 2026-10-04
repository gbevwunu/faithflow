import "server-only";

import type { ChurchConfig, TeamRole } from "@/lib/config";
import type { DataSource, IsoDate } from "@/lib/data";
import { capitalize } from "@/lib/format";
import {
  getLatestServiceDate,
  getMarkingWindow,
  getServiceDate,
  zonedTimeToInstant,
  type MarkingState,
} from "@/lib/rules";
import { toClientRoster, type ClientRosterEntry } from "./client-roster";
import type { Session } from "./request-context";

/** Everything the attendance screen needs, and nothing more. Safe to send to the browser. */
export interface AttendanceScreenData {
  church: string;
  churchName: string;
  timezone: string;
  serviceDay: string;
  serviceTitle: string;
  serviceDate: IsoDate;
  isServiceDay: boolean;
  role: TeamRole;
  viewerName: string;
  /** The server's current instant (possibly faked in development). */
  now: string;
  state: MarkingState;
  allowed: boolean;
  teamLockTime: string;
  correctionEndTime: string;
  /** Instants of the team lock and the end of corrections on the service date. */
  teamLockAt: string;
  correctionEndAt: string;
  roster: ClientRosterEntry[];
}

export async function loadAttendanceScreen(
  config: ChurchConfig,
  session: Session,
  now: Date,
  dataSource: DataSource,
): Promise<AttendanceScreenData> {
  const { schedule, timezone } = config;
  const window = getMarkingWindow(now, session.role, config);
  // On other days, show the latest service day's roster, read-only.
  const serviceDate = getLatestServiceDate(now, config);
  const roster = await dataSource.getRoster(serviceDate);

  return {
    church: config.slug,
    churchName: config.displayName,
    timezone,
    serviceDay: schedule.serviceDay,
    serviceTitle: `${capitalize(schedule.serviceDay)} Service`,
    serviceDate,
    isServiceDay: serviceDate === getServiceDate(now, config),
    role: session.role,
    viewerName: session.name,
    now: now.toISOString(),
    state: window.state,
    allowed: window.allowed,
    teamLockTime: schedule.teamLockTime,
    correctionEndTime: schedule.correctionEndTime,
    teamLockAt: zonedTimeToInstant(serviceDate, schedule.teamLockTime, timezone).toISOString(),
    correctionEndAt: zonedTimeToInstant(
      serviceDate,
      schedule.correctionEndTime,
      timezone,
    ).toISOString(),
    roster: toClientRoster(roster, config),
  };
}
