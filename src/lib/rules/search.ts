import type { RosterEntry } from "@/lib/data";

const LAST_FOUR_DIGITS = /^\d{4}$/;
// Spaces, hyphens (including the Unicode hyphen and en dash) and straight or curly apostrophes.
const WORD_SEPARATORS = /[\s\-\u2010\u2013'\u2018\u2019\u02bc]+/;
const collator = new Intl.Collator("en", { sensitivity: "base" });

/** Lowercases, strips accents and collapses whitespace so "  Adébáyo " matches "adebayo". */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function words(name: string): string[] {
  return name.split(WORD_SEPARATORS).filter((word) => word !== "");
}

/** The parts of an entry that search looks at. */
export interface SearchFields {
  firstName: string;
  lastName: string;
  /** The full phone, or at least its last four digits; matched by suffix. */
  phone: string;
}

function matches(fields: SearchFields, query: string): boolean {
  if (LAST_FOUR_DIGITS.test(query)) {
    return fields.phone.endsWith(query);
  }
  const first = foldForSearch(fields.firstName);
  const last = foldForSearch(fields.lastName);
  return (
    `${first} ${last}`.startsWith(query) ||
    first.startsWith(query) ||
    last.startsWith(query) ||
    [...words(first), ...words(last)].some((word) => word.startsWith(query))
  );
}

const rosterEntryFields = (entry: RosterEntry): SearchFields => entry.person;

/**
 * Filters roster entries by name prefix (the full name, the first or last name, or any
 * word within them, split on spaces, hyphens and apostrophes) or, for exactly
 * four digits, by the last four digits of the phone. Case and accent insensitive.
 * Exact first-name matches come first, then alphabetical by first then last name.
 * Returns a new array; the input is not modified.
 *
 * Entries of another shape can be searched by passing `fields` to read their names and phone.
 */
export function searchRoster(entries: readonly RosterEntry[], query: string): RosterEntry[];
export function searchRoster<T>(
  entries: readonly T[],
  query: string,
  fields: (entry: T) => SearchFields,
): T[];
export function searchRoster<T>(
  entries: readonly T[],
  query: string,
  fields: (entry: T) => SearchFields = rosterEntryFields as unknown as (entry: T) => SearchFields,
): T[] {
  const q = foldForSearch(query);
  const results = q === "" ? [...entries] : entries.filter((entry) => matches(fields(entry), q));

  return results.sort((a, b) => {
    const fa = fields(a);
    const fb = fields(b);
    const aExact = q !== "" && foldForSearch(fa.firstName) === q;
    const bExact = q !== "" && foldForSearch(fb.firstName) === q;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return (
      collator.compare(fa.firstName, fb.firstName) || collator.compare(fa.lastName, fb.lastName)
    );
  });
}
