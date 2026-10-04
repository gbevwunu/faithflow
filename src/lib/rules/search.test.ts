import { describe, expect, it } from "vitest";
import type { Member, RosterEntry } from "@/lib/data";
import { foldForSearch, searchRoster } from "./search";

let nextPhone = 100;
function entry(firstName: string, lastName: string, phone?: string): RosterEntry {
  const person: Member = {
    id: `${firstName}-${lastName}`,
    list: "member",
    firstName,
    lastName,
    phone: phone ?? `+1204555${String(nextPhone++).padStart(4, "0")}`,
  };
  return { person, mark: null };
}

const roster: RosterEntry[] = [
  entry("Adebayo", "Okafor", "+12045550148"),
  entry("Ade", "Bello", "+12045550150"),
  entry("Adaeze", "Nnamdi", "+12045550151"),
  entry("Chinedu", "Eze", "+12045550152"),
  entry("Precious", "Eze", "+12045550153"),
  entry("Zoë", "Ádémólá", "+12045550154"),
  entry("Kemi", "Oladipo", "+12045550155"),
  entry("Oladipo", "Adeyemi", "+12045550156"),
];

function names(results: RosterEntry[]): string[] {
  return results.map((e) => `${e.person.firstName} ${e.person.lastName}`);
}

describe("foldForSearch", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(foldForSearch("  Zoë   ÁDÉMÓLÁ ")).toBe("zoe ademola");
  });
});

describe("searchRoster", () => {
  it("returns everyone, sorted, for an empty or blank query", () => {
    expect(names(searchRoster(roster, ""))).toEqual([
      "Adaeze Nnamdi",
      "Ade Bello",
      "Adebayo Okafor",
      "Chinedu Eze",
      "Kemi Oladipo",
      "Oladipo Adeyemi",
      "Precious Eze",
      "Zoë Ádémólá",
    ]);
    expect(searchRoster(roster, "   ")).toHaveLength(roster.length);
  });

  it("matches the start of the first name, case-insensitively", () => {
    expect(names(searchRoster(roster, "CHIN"))).toEqual(["Chinedu Eze"]);
  });

  it("matches the start of the last name", () => {
    expect(names(searchRoster(roster, "eze"))).toEqual(["Chinedu Eze", "Precious Eze"]);
  });

  it("matches the start of the full name", () => {
    expect(names(searchRoster(roster, "kemi ola"))).toEqual(["Kemi Oladipo"]);
    expect(names(searchRoster(roster, "  kemi   ola "))).toEqual(["Kemi Oladipo"]);
  });

  it("does not match the middle of a name", () => {
    expect(searchRoster(roster, "nedu")).toEqual([]);
    expect(searchRoster(roster, "eze chinedu")).toEqual([]);
  });

  it("is accent-insensitive in both directions", () => {
    expect(names(searchRoster(roster, "zoe"))).toEqual(["Zoë Ádémólá"]);
    expect(names(searchRoster(roster, "ademola"))).toEqual(["Zoë Ádémólá"]);
    expect(names(searchRoster(roster, "Zoë"))).toEqual(["Zoë Ádémólá"]);
    expect(names(searchRoster(roster, "chínedu"))).toEqual(["Chinedu Eze"]);
  });

  it("puts exact first-name matches first, then sorts by first and last name", () => {
    expect(names(searchRoster(roster, "ade"))).toEqual([
      "Ade Bello",
      "Adebayo Okafor",
      "Oladipo Adeyemi",
      "Zoë Ádémólá",
    ]);
    expect(names(searchRoster(roster, "oladipo"))).toEqual(["Oladipo Adeyemi", "Kemi Oladipo"]);
  });

  it("matches exactly four digits against the last four digits of the phone", () => {
    expect(names(searchRoster(roster, "0148"))).toEqual(["Adebayo Okafor"]);
    expect(names(searchRoster(roster, " 0152 "))).toEqual(["Chinedu Eze"]);
    expect(searchRoster(roster, "2045")).toEqual([]);
  });

  it("does not match other digit counts against the phone", () => {
    expect(searchRoster(roster, "148")).toEqual([]);
    expect(searchRoster(roster, "50148")).toEqual([]);
  });

  it("does not modify the input array", () => {
    const copy = [...roster];
    searchRoster(roster, "");
    expect(roster).toEqual(copy);
  });

  describe("word prefixes within names", () => {
    const people: RosterEntry[] = [
      entry("Funke", "Adeyemi-Bakare", "+12045550160"),
      entry("Tola", "Ade Okafor", "+12045550161"),
      entry("Siobhan", "O'Brien", "+12045550162"),
      entry("Patrick", "O\u2019Brien", "+12045550163"),
      entry("Mary Jane", "Nwosu", "+12045550164"),
      entry("Chinedu", "Eze", "+12045550165"),
    ];

    it("matches a word after a hyphen", () => {
      expect(names(searchRoster(people, "bakare"))).toEqual(["Funke Adeyemi-Bakare"]);
      expect(names(searchRoster(people, "adeyemi-bak"))).toEqual(["Funke Adeyemi-Bakare"]);
    });

    it("matches a word after a space in the last name", () => {
      expect(names(searchRoster(people, "okafor"))).toEqual(["Tola Ade Okafor"]);
      expect(names(searchRoster(people, "ade ok"))).toEqual(["Tola Ade Okafor"]);
    });

    it("matches a word after a straight or curly apostrophe", () => {
      expect(names(searchRoster(people, "brien"))).toEqual([
        "Patrick O\u2019Brien",
        "Siobhan O'Brien",
      ]);
      expect(names(searchRoster(people, "o'b"))).toEqual(["Siobhan O'Brien"]);
    });

    it("matches each word of a two-word first name, and the whole first name", () => {
      expect(names(searchRoster(people, "jane"))).toEqual(["Mary Jane Nwosu"]);
      expect(names(searchRoster(people, "mary j"))).toEqual(["Mary Jane Nwosu"]);
      expect(names(searchRoster(people, "mary jane nw"))).toEqual(["Mary Jane Nwosu"]);
    });

    it("treats a two-word first name as an exact first-name match", () => {
      const withMary = [...people, entry("Mary", "Okoro", "+12045550166")];
      expect(names(searchRoster(withMary, "mary jane"))).toEqual(["Mary Jane Nwosu"]);
      expect(names(searchRoster(withMary, "mary"))).toEqual(["Mary Okoro", "Mary Jane Nwosu"]);
    });

    it("stays prefix-only within each word", () => {
      expect(searchRoster(people, "nedu")).toEqual([]);
      expect(searchRoster(people, "kare")).toEqual([]);
      expect(searchRoster(people, "rien")).toEqual([]);
      expect(searchRoster(people, "ane")).toEqual([]);
    });
  });
});
