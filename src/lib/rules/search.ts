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

function matches(entry: RosterEntry, query: string): boolean {
  if (LAST_FOUR_DIGITS.test(query)) {
    return entry.person.phone.endsWith(query);
  }
  const first = foldForSearch(entry.person.firstName);
  const last = foldForSearch(entry.person.lastName);
  return (
    `${first} ${last}`.startsWith(query) ||
    first.startsWith(query) ||
    last.startsWith(query) ||
    [...words(first), ...words(last)].some((word) => word.startsWith(query))
  );
}

/**
 * Filters roster entries by name prefix (the full name, the first or last name, or any
 * word within them, split on spaces, hyphens and apostrophes) or, for exactly
 * four digits, by the last four digits of the phone. Case and accent insensitive.
 * Exact first-name matches come first, then alphabetical by first then last name.
 * Returns a new array; the input is not modified.
 */
export function searchRoster(entries: readonly RosterEntry[], query: string): RosterEntry[] {
  const q = foldForSearch(query);
  const results = q === "" ? [...entries] : entries.filter((entry) => matches(entry, q));

  return results.sort((a, b) => {
    const aExact = q !== "" && foldForSearch(a.person.firstName) === q;
    const bExact = q !== "" && foldForSearch(b.person.firstName) === q;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return (
      collator.compare(a.person.firstName, b.person.firstName) ||
      collator.compare(a.person.lastName, b.person.lastName)
    );
  });
}
