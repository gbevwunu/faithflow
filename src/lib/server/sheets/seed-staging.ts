import "server-only";

import { appendRange, dataColumnRange, headerRowRange } from "./a1";
import type { SheetsClient } from "./client";
import type { SheetsLayout } from "./google-sheets-data-source";
import { mapHeaders, rowFor } from "./layout";

// Fixed fake people. Phones stay in the fictional 555-0100 to 555-0199 range.
const MEMBER_NAMES: readonly (readonly [string, string])[] = [
  ["Adebayo", "Okafor"],
  ["Chinedu", "Eze"],
  ["Ngozi", "Adeyemi"],
  ["Oluwaseun", "Bello"],
  ["Funmilayo", "Oyelaran"],
  ["Emeka", "Nwosu"],
  ["Chiamaka", "Obi"],
  ["Tunde", "Bakare"],
  ["Folake", "Adebisi"],
  ["Ifeanyi", "Okonkwo"],
  ["Yetunde", "Ogunleye"],
  ["Babatunde", "Afolabi"],
  ["Adaeze", "Nnamdi"],
  ["Kehinde", "Alabi"],
  ["Taiwo", "Alabi"],
  ["Obinna", "Chukwu"],
  ["Blessing", "Ogbonna"],
  ["Femi", "Adewale"],
  ["Kemi", "Oladipo"],
  ["Uche", "Anyanwu"],
  ["Segun", "Fashola"],
  ["Amaka", "Iwu"],
  ["Chidi", "Onyeka"],
  ["Bukola", "Adeniyi"],
  ["Damilola", "Ojo"],
  ["Ikechukwu", "Udeh"],
  ["Temitope", "Ajayi"],
  ["Nkechi", "Okeke"],
  ["Gbenga", "Oyewole"],
  ["Ebere", "Mbah"],
];

const NEWCOMERS: readonly {
  firstName: string;
  lastName: string;
  heardVia: string;
  invitedBy: string;
  birthday: string;
  occupation: string;
  consent: string;
}[] = [
  {
    firstName: "Tobi",
    lastName: "Adegoke",
    heardVia: "Friend",
    invitedBy: "Ngozi Adeyemi",
    birthday: "March 14",
    occupation: "Nurse",
    consent: "Yes",
  },
  {
    firstName: "Zainab",
    lastName: "Musa",
    heardVia: "Social media: Instagram",
    invitedBy: "",
    birthday: "",
    occupation: "",
    consent: "Yes",
  },
  {
    firstName: "Ifunanya",
    lastName: "Obiora",
    heardVia: "Flier",
    invitedBy: "",
    birthday: "November 2",
    occupation: "Student",
    consent: "No",
  },
  {
    firstName: "Chukwuemeka",
    lastName: "Igwe",
    heardVia: "Friend",
    invitedBy: "",
    birthday: "",
    occupation: "Software developer",
    consent: "Yes",
  },
  {
    firstName: "Aisha",
    lastName: "Bello",
    heardVia: "Other: Walked past the building",
    invitedBy: "",
    birthday: "July 21",
    occupation: "",
    consent: "Yes",
  },
  {
    firstName: "Seyi",
    lastName: "Odunsi",
    heardVia: "Social media: Facebook",
    invitedBy: "",
    birthday: "",
    occupation: "Accountant",
    consent: "Yes",
  },
  {
    firstName: "Precious",
    lastName: "Eze",
    heardVia: "Friend",
    invitedBy: "Chinedu Eze",
    birthday: "",
    occupation: "",
    consent: "No",
  },
  // Free text as entered on the old form, to exercise lenient reading.
  {
    firstName: "Kunle",
    lastName: "Adesina",
    heardVia: "saw the church sign on Sunday",
    invitedBy: "",
    birthday: "",
    occupation: "",
    consent: "Yes",
  },
];

export class SeedRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SeedRefusedError";
  }
}

const phone = (n: number) => `204555${String(n).padStart(4, "0")}`;

/**
 * Fills an empty staging spreadsheet with fake people. Refuses unless the spreadsheet title
 * contains "STAGING" and every mapped column is empty below the header row.
 */
export async function seedStagingSheet(options: {
  client: SheetsClient;
  layout: SheetsLayout;
  generateId?: () => string;
  firstVisitDate: string;
}): Promise<{ members: number; newcomers: number }> {
  const { client, layout } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const title = await client.getTitle();
  if (!title.includes("STAGING")) {
    throw new SeedRefusedError('Refused: the spreadsheet title does not contain "STAGING".');
  }

  const tabs = ["members", "newcomers", "tickLog"] as const;
  const headerRows = await client.batchGetRows(tabs.map((key) => headerRowRange(layout[key].tab)));
  const positions = Object.fromEntries(
    tabs.map((key, i) => [
      key,
      mapHeaders(
        layout[key].tab,
        layout[key].columns as Record<string, string>,
        headerRows[i] ?? [],
      ),
    ]),
  ) as Record<(typeof tabs)[number], Record<string, number>>;

  const ranges = tabs.flatMap((key) =>
    Object.values(positions[key]).map((column) => dataColumnRange(layout[key].tab, column)),
  );
  const columns = await client.batchGetColumns(ranges);
  if (columns.some((column) => column.some((cell) => String(cell ?? "").trim() !== ""))) {
    throw new SeedRefusedError("Refused: the sheet already has data rows.");
  }

  await client.appendRows(
    appendRange(layout.members.tab),
    MEMBER_NAMES.map(([firstName, lastName], i) =>
      rowFor(positions.members, {
        personId: generateId(),
        firstName,
        lastName,
        // Mix the two stored formats: 10 digits and 11 with a leading 1, as plain numbers.
        phone: i % 4 === 0 ? Number(`1${phone(100 + i)}`) : Number(phone(100 + i)),
        attended: "No",
      }),
    ),
  );

  await client.appendRows(
    appendRange(layout.newcomers.tab),
    NEWCOMERS.map((n, i) =>
      rowFor(positions.newcomers, {
        personId: generateId(),
        firstName: n.firstName,
        lastName: n.lastName,
        email: `${n.firstName}.${n.lastName}@example.com`.toLowerCase(),
        phone: Number(phone(140 + i)),
        heardVia: n.heardVia,
        invitedBy: n.invitedBy,
        firstVisitDate: options.firstVisitDate,
        attended: "No",
        birthday: n.birthday,
        occupation: n.occupation,
        consent: n.consent,
        optedOut: "No",
      }),
    ),
  );

  return { members: MEMBER_NAMES.length, newcomers: NEWCOMERS.length };
}
