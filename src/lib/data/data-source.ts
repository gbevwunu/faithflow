import type { AttendanceMark, IsoDate, Newcomer, Person, PhoneE164, RosterEntry } from "./types";

export interface MarkPresentInput {
  personId: string;
  serviceDate: IsoDate;
  /** Team member id. */
  markedBy: string;
  isCorrection: boolean;
}

export interface UnmarkInput {
  personId: string;
  serviceDate: IsoDate;
  /** Team member id. */
  by: string;
  isCorrection: boolean;
}

export type AddNewcomerInput = Omit<Newcomer, "id" | "list">;

/**
 * The only way components and routes read or write church data.
 * Phone inputs must already be E.164.
 */
export interface DataSource {
  /**
   * Everyone on the roster for a service date with their mark, if any.
   * A newcomer whose phone matches a member is left out; the member record wins.
   */
  getRoster(serviceDate: IsoDate): Promise<RosterEntry[]>;

  /** Idempotent: marking an already-marked person returns the existing mark. */
  markPresent(input: MarkPresentInput): Promise<AttendanceMark>;

  /** Idempotent: unmarking someone without a mark does nothing. */
  unmark(input: UnmarkInput): Promise<void>;

  /** Rejects with DuplicatePhoneError if the phone is already on either list. */
  addNewcomer(input: AddNewcomerInput): Promise<Newcomer>;

  /** Returns the member record when the phone is on both lists. */
  findByPhone(phone: PhoneE164): Promise<Person | null>;
}
