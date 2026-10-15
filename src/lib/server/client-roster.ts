import "server-only";

import { getTeamMemberName, type ChurchConfig } from "@/lib/config";
import type { AttendanceMark, PersonList, RosterEntry } from "@/lib/data";

/**
 * A mark as the browser sees it: a display name instead of a team member id. Both are null
 * when the mark has no attribution, such as a tick made directly in the spreadsheet.
 */
export interface ClientMark {
  markedByName: string | null;
  markedAt: string | null;
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
    markedByName: mark.markedBy
      ? (getTeamMemberName(config, mark.markedBy) ?? "Former team member")
      : null,
    markedAt: mark.markedAt || null,
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
