import "server-only";

import { getTeamMemberName, type ChurchConfig } from "@/lib/config";
import type { AttendanceMark, PersonList, RosterEntry } from "@/lib/data";

/** A mark as the browser sees it: a display name instead of a team member id. */
export interface ClientMark {
  markedByName: string;
  markedAt: string;
}

/** A roster row as the browser sees it. No full phone, email or team member ids. */
export interface ClientRosterEntry {
  id: string;
  firstName: string;
  lastName: string;
  list: PersonList;
  phoneLast4: string;
  mark: ClientMark | null;
}

export function toClientMark(mark: AttendanceMark, config: ChurchConfig): ClientMark {
  return {
    markedByName: getTeamMemberName(config, mark.markedBy) ?? "Former team member",
    markedAt: mark.markedAt,
  };
}

/** Reduces roster entries to the fields the attendance screen needs, building new objects. */
export function toClientRoster(
  entries: readonly RosterEntry[],
  config: ChurchConfig,
): ClientRosterEntry[] {
  return entries.map(({ person, mark }) => ({
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    list: person.list,
    phoneLast4: person.phone.slice(-4),
    mark: mark ? toClientMark(mark, config) : null,
  }));
}
