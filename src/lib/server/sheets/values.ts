import "server-only";

import type { Birthday, HeardVia, HeardViaSource, IsoDate } from "@/lib/data";
import { normalizePhone } from "@/lib/rules";

export type CellValue = string | number | boolean | null | undefined;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const cellText = (value: CellValue): string =>
  value === null || value === undefined ? "" : String(value).trim();

/** Phones are stored as plain numbers, some with a leading 1. Returns E.164 or null. */
export function phoneFromCell(value: CellValue): string | null {
  return normalizePhone(cellText(value));
}

/** E.164 to the 10-digit form the sheet already uses: +12045550148 -> 2045550148. */
export function phoneToCell(phone: string): string {
  return phone.replace(/^\+1/, "");
}

export const yesNo = (value: boolean) => (value ? "Yes" : "No");
export const isYes = (value: CellValue) => cellText(value) === "Yes";

/** { month: 9, day: 14 } -> "September 14". */
export function birthdayToCell(birthday: Birthday): string {
  return `${MONTHS[birthday.month - 1]} ${birthday.day}`;
}

/** "September 14" (any case, optional "Sept"-style prefix) -> { month: 9, day: 14 }; else undefined. */
export function birthdayFromCell(value: CellValue): Birthday | undefined {
  const match = /^([A-Za-z]+)\.?\s+(\d{1,2})$/.exec(cellText(value));
  if (!match) return undefined;
  const [, name = "", dayText = ""] = match;
  const month =
    MONTHS.findIndex((m) => name.length >= 3 && m.toLowerCase().startsWith(name.toLowerCase())) + 1;
  const day = Number(dayText);
  return month > 0 && day >= 1 && day <= 31 ? { month, day } : undefined;
}

const HEARD_VIA_LABELS: Record<HeardViaSource, string> = {
  friend: "Friend",
  social_media: "Social media",
  flier: "Flier",
  other: "Other",
};

/**
 * Writes "How did you hear about us?": the chip label, with a friend's name going to
 * "Who invited you to church?" and other follow-ups appended, e.g. "Social media: Instagram".
 */
export function heardViaToCells(heardVia: HeardVia): { heardVia: string; invitedBy: string } {
  const label = HEARD_VIA_LABELS[heardVia.source];
  if (heardVia.source === "friend") return { heardVia: label, invitedBy: heardVia.detail ?? "" };
  return { heardVia: heardVia.detail ? `${label}: ${heardVia.detail}` : label, invitedBy: "" };
}

/**
 * Reads the heard-via cells, tolerating free text from the old form: anything that is not one
 * of the chip labels becomes "other" with the original text kept as the detail.
 */
export function heardViaFromCells(heardViaCell: CellValue, invitedByCell: CellValue): HeardVia {
  const text = cellText(heardViaCell);
  const invitedBy = cellText(invitedByCell);
  const [labelPart = "", ...rest] = text.split(":");
  const label = labelPart.trim().toLowerCase();
  const detail = rest.join(":").trim();
  const source = (Object.keys(HEARD_VIA_LABELS) as HeardViaSource[]).find(
    (s) => HEARD_VIA_LABELS[s].toLowerCase() === label || (s === "flier" && label === "flyer"),
  );

  if (source === "friend")
    return invitedBy || detail ? { source, detail: invitedBy || detail } : { source };
  if (source) return detail ? { source, detail } : { source };
  if (text === "") return invitedBy ? { source: "friend", detail: invitedBy } : { source: "other" };
  return { source: "other", detail: text };
}

/** Dates are kept as text: ISO "2026-09-27" or US "9/27/2026". Anything else gives "". */
export function isoDateFromCell(value: CellValue): IsoDate {
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) {
    const [, m = "", d = "", y = ""] = us;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}
