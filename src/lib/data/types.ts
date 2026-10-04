/** An E.164 phone number, e.g. +12045550101. */
export type PhoneE164 = string;

/** A calendar date in "YYYY-MM-DD" form. */
export type IsoDate = string;

/** An ISO 8601 timestamp with offset, e.g. 2026-10-04T15:30:00.000Z. */
export type IsoDateTime = string;

export type PersonList = "member" | "newcomer";

export type HeardViaSource = "friend" | "social_media" | "flier" | "other";

export interface HeardVia {
  source: HeardViaSource;
  detail?: string;
}

export interface Birthday {
  month: number;
  day: number;
}

interface PersonBase {
  /** Opaque identifier. Do not parse or assume a format. */
  id: string;
  firstName: string;
  lastName: string;
  phone: PhoneE164;
  email?: string;
}

export interface Member extends PersonBase {
  list: "member";
}

export interface Newcomer extends PersonBase {
  list: "newcomer";
  birthday?: Birthday;
  occupation?: string;
  heardVia: HeardVia;
  firstVisitDate: IsoDate;
  consentToMessages: boolean;
  optedOut: boolean;
}

export type Person = Member | Newcomer;

export interface AttendanceMark {
  personId: string;
  serviceDate: IsoDate;
  /** Id of the team member who made the mark, from the church config. */
  markedBy: string;
  markedAt: IsoDateTime;
  isCorrection: boolean;
}

export interface RosterEntry {
  person: Person;
  mark: AttendanceMark | null;
}
