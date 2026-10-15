import { describe, expect, it, vi } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { DuplicatePhoneError, type AddNewcomerInput } from "@/lib/data";
import { quoteSheetName } from "./a1";
import { createSheetsClient, type CellValue } from "./client";
import { createGoogleSheetsDataSource, MissingHeaderError } from "./google-sheets-data-source";
import { createFakeSheetsApi } from "./testing/fake-sheets-api";

const config = getChurchConfig("newbreed");
if (config.dataSource.type !== "google-sheets") throw new Error("expected google-sheets config");
const layout = config.dataSource;

const MEMBERS = 'Template "26';
const NEWCOMERS = "New Comers 2026";
const TICK_LOG = "Tick Log";
const SUNDAY = "2026-10-04";
const TEAM_ID = "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f";
const ADMIN_ID = "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1";
const SECRET = "IMMIGRATION-SECRET";

// Columns deliberately out of order, with unmapped columns in between.
const memberHeader = [
  "Last Name",
  "Immigration Status",
  "Person ID",
  "Notes",
  "Phone Number",
  "First Name",
  "Attended Church",
];
const member = (id: string, first: string, last: string, phone: CellValue, attended = "No") => [
  last,
  `${SECRET}-${first}`,
  id,
  "private note",
  phone,
  first,
  attended,
];

const newcomerHeader = [
  "Person ID",
  "Date",
  "Name - First Name",
  "Name - Last Name",
  "Email",
  "Phone Number",
  "How did you find out about us?",
  "Who invited you to church?",
  "Attended Church",
  "Birthday",
  "Occupation",
  "Consent to Messages",
  "Opted Out",
  "Prayer Request",
];

const tickLogHeader = [
  "Timestamp",
  "Service Date",
  "Person ID",
  "List",
  "Action",
  "Marked By",
  "Correction",
];

function setup(overrides: { title?: string; tabs?: Record<string, CellValue[][]> } = {}) {
  const api = createFakeSheetsApi({
    title: overrides.title ?? "NewBreed Attendance",
    tabs: overrides.tabs ?? {
      [MEMBERS]: [
        memberHeader,
        member("m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"),
        member("m-2", "Tunde", "Bakare", 12045550102),
        member("m-3", "Kemi", "Oladipo", "(204) 555-0103"),
        member("m-4", "Femi", "Adewale", 5550104),
        member("", "No", "Identifier", 2045550105),
        member("", "Another", "Blank", 2045550106),
      ],
      [NEWCOMERS]: [
        newcomerHeader,
        [
          "n-1",
          "2026-09-27",
          "Tobi",
          "Adegoke",
          "tobi@example.com",
          2045550140,
          "Friend",
          "Tunde Bakare",
          "No",
          "March 14",
          "Nurse",
          "Yes",
          "No",
          "please pray",
        ],
        [
          "n-2",
          "9/27/2026",
          "Zainab",
          "Musa",
          "",
          12045550141,
          "my cousin told me about it",
          "",
          "Yes",
          "",
          "",
          "No",
          "No",
          "",
        ],
        [
          "n-3",
          "",
          "Kemi",
          "Oladipo",
          "",
          2045550103,
          "Social media: Instagram",
          "",
          "No",
          "Sept 3",
          "",
          "No",
          "No",
          "",
        ],
      ],
      [TICK_LOG]: [
        tickLogHeader,
        ["2026-10-04T15:00:00.000Z", SUNDAY, "m-1", "member", "mark", ADMIN_ID, "No"],
        ["2026-10-04T15:42:00.000Z", SUNDAY, "m-1", "member", "mark", TEAM_ID, "No"],
      ],
    },
  });
  const warn = vi.fn();
  const client = createSheetsClient({
    spreadsheetId: "test-spreadsheet",
    getAccessToken: async () => "test-token",
    fetch: api.fetch,
  });
  const ds = createGoogleSheetsDataSource({
    client,
    layout,
    lockKey: `test-${Math.random()}`,
    now: () => new Date("2026-10-04T16:00:00.000Z"),
    generateId: () => "11111111-2222-4333-8444-555555555555",
    warn,
  });
  return { api, ds, warn };
}

const newcomerInput = (overrides: Partial<AddNewcomerInput> = {}): AddNewcomerInput => ({
  firstName: "Adebayo",
  lastName: "Ogunleye",
  phone: "+12045550148",
  email: "adebayo@example.com",
  birthday: { month: 9, day: 14 },
  occupation: "Nurse",
  heardVia: { source: "friend", detail: "Tunde Bakare" },
  firstVisitDate: SUNDAY,
  consentToMessages: true,
  optedOut: false,
  ...overrides,
});

describe("A1 notation", () => {
  it("quotes tab names, doubling single quotes", () => {
    expect(quoteSheetName('Template "26')).toBe(`'Template "26'`);
    expect(quoteSheetName("New Comers 2026")).toBe("'New Comers 2026'");
    expect(quoteSheetName("O'Brien's List")).toBe("'O''Brien''s List'");
  });

  it("requests the members tab with a correctly quoted range", async () => {
    const { api, ds } = setup();
    await ds.getRoster(SUNDAY);
    const ranges = api.requests.flatMap((r) => r.ranges);
    expect(ranges).toContain(`'Template "26'!1:1`);
    expect(ranges).toContain(`'Template "26'!C2:C`);
  });
});

describe("reading", () => {
  it("requests only the mapped member columns and never Immigration Status", async () => {
    const { api, ds } = setup();
    await ds.getRoster(SUNDAY);
    await ds.findByPhone("+12045550101");

    const memberRanges = api.requests
      .flatMap((r) => r.ranges)
      .filter((r) => r.startsWith(`'Template "26'`));
    // Person ID C, Last Name A, Phone E, First Name F, Attended G. Never B (Immigration) or D.
    const columns = new Set(
      memberRanges.filter((r) => r !== `'Template "26'!1:1`).map((r) => r.split("!")[1]),
    );
    expect(columns).toEqual(new Set(["A2:A", "C2:C", "E2:E", "F2:F", "G2:G"]));

    for (const request of api.requests) {
      expect(JSON.stringify(request)).not.toContain("Immigration Status");
    }
    expect(api.servedCells.some((cell) => String(cell).includes(SECRET))).toBe(false);
    expect(api.servedCells).not.toContain("private note");
  });

  it("reads each tab's columns in one batchGet after reading the header rows", async () => {
    const { api, ds } = setup();
    await ds.getRoster(SUNDAY);
    expect(api.requests).toHaveLength(2);
    expect(api.requests[0]?.ranges).toEqual([
      `'Template "26'!1:1`,
      "'New Comers 2026'!1:1",
      "'Tick Log'!1:1",
    ]);
  });

  it("fails with a clear error naming the tab and header when a header is missing", async () => {
    const { ds } = setup({
      tabs: {
        [MEMBERS]: [
          memberHeader.filter((h) => h !== "Phone Number"),
          ["Nnamdi", "x", "m-1", "", "Adaeze", "No"],
        ],
        [NEWCOMERS]: [newcomerHeader],
        [TICK_LOG]: [tickLogHeader],
      },
    });
    const error = await ds.getRoster(SUNDAY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MissingHeaderError);
    expect((error as Error).message).toBe(
      'Sheet tab "Template "26" has no column headed "Phone Number" in row 1.',
    );
    expect((error as Error).message).not.toMatch(/Adaeze|Nnamdi|m-1/);
  });

  it("normalizes phones stored as 10 digits, 11 digits with a leading 1, or text", async () => {
    const { ds } = setup();
    const roster = await ds.getRoster(SUNDAY);
    const phoneOf = (id: string) => roster.find((e) => e.person.id === id)?.person.phone;
    expect(phoneOf("m-1")).toBe("+12045550101");
    expect(phoneOf("m-2")).toBe("+12045550102");
    expect(phoneOf("m-3")).toBe("+12045550103");
    expect(phoneOf("n-2")).toBe("+12045550141");
  });

  it("keeps rows with an invalid phone on the roster", async () => {
    const { ds } = setup();
    const femi = (await ds.getRoster(SUNDAY)).find((e) => e.person.id === "m-4");
    expect(femi?.person).toMatchObject({ firstName: "Femi", phone: "" });
  });

  it("excludes rows without a Person ID and logs only their count", async () => {
    const { ds, warn } = setup();
    const roster = await ds.getRoster(SUNDAY);
    expect(
      roster.some((e) => e.person.firstName === "No" || e.person.firstName === "Another"),
    ).toBe(false);
    expect(warn).toHaveBeenCalledWith("Skipped sheet rows without a Person ID", {
      tab: MEMBERS,
      count: 2,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/Identifier|Blank|555/);
  });

  it("marks people whose Attended Church is Yes, attributed from the latest Tick Log entry", async () => {
    const { ds } = setup();
    const roster = await ds.getRoster(SUNDAY);
    expect(roster.find((e) => e.person.id === "m-1")?.mark).toEqual({
      personId: "m-1",
      serviceDate: SUNDAY,
      markedBy: TEAM_ID,
      markedAt: "2026-10-04T15:42:00.000Z",
      isCorrection: false,
    });
    expect(roster.find((e) => e.person.id === "m-1")?.staleMark).toBeUndefined();
    // Yes with no tick logged for this date: marked without attribution, and flagged as stale.
    const n2 = roster.find((e) => e.person.id === "n-2");
    expect(n2?.mark).toMatchObject({ markedBy: "", markedAt: "" });
    expect(n2?.staleMark).toBe(true);
    expect(roster.find((e) => e.person.id === "m-2")?.mark).toBeNull();
  });

  it("reads old free-text heard-via answers without failing", async () => {
    const { ds } = setup();
    const roster = await ds.getRoster(SUNDAY);
    const newcomer = (id: string) => roster.find((e) => e.person.id === id)?.person;
    expect(newcomer("n-1")).toMatchObject({
      heardVia: { source: "friend", detail: "Tunde Bakare" },
      birthday: { month: 3, day: 14 },
      firstVisitDate: "2026-09-27",
      consentToMessages: true,
      email: "tobi@example.com",
    });
    expect(newcomer("n-2")).toMatchObject({
      heardVia: { source: "other", detail: "my cousin told me about it" },
      firstVisitDate: "2026-09-27",
    });
  });

  it("applies member-wins: a newcomer sharing a member's phone is not listed twice", async () => {
    const { ds } = setup();
    const roster = await ds.getRoster(SUNDAY);
    expect(roster.filter((e) => e.person.phone === "+12045550103").map((e) => e.person.id)).toEqual(
      ["m-3"],
    );
    expect((await ds.findByPhone("+12045550103"))?.id).toBe("m-3");
  });
});

describe("writing", () => {
  it("ticking writes Yes to Attended Church and appends a Tick Log row", async () => {
    const { api, ds } = setup();
    const mark = await ds.markPresent({
      personId: "m-2",
      serviceDate: SUNDAY,
      markedBy: TEAM_ID,
      isCorrection: false,
      markedAt: new Date("2026-10-04T16:05:00.000Z"),
    });
    expect(api.tab(MEMBERS)[2]?.[6]).toBe("Yes");
    expect(api.tab(TICK_LOG).at(-1)).toEqual([
      "2026-10-04T16:05:00.000Z",
      SUNDAY,
      "m-2",
      "member",
      "mark",
      TEAM_ID,
      "No",
    ]);
    expect(mark).toMatchObject({ markedBy: TEAM_ID, markedAt: "2026-10-04T16:05:00.000Z" });
    expect(api.tab(MEMBERS)[2]?.[1]).toBe(`${SECRET}-Tunde`);
  });

  it("unticking writes No and appends an unmark Tick Log row marked as a correction", async () => {
    const { api, ds } = setup();
    await ds.unmark({ personId: "m-1", serviceDate: SUNDAY, by: ADMIN_ID, isCorrection: true });
    expect(api.tab(MEMBERS)[1]?.[6]).toBe("No");
    expect(api.tab(TICK_LOG).at(-1)).toEqual([
      "2026-10-04T16:00:00.000Z",
      SUNDAY,
      "m-1",
      "member",
      "unmark",
      ADMIN_ID,
      "Yes",
    ]);
  });

  it("is idempotent: ticking twice writes once, unticking someone not ticked writes nothing", async () => {
    const { api, ds } = setup();
    const input = { personId: "m-2", serviceDate: SUNDAY, markedBy: TEAM_ID, isCorrection: false };
    const first = await ds.markPresent(input);
    const writesAfterFirst = api.requests.filter((r) => r.method !== "GET").length;
    expect(await ds.markPresent({ ...input, markedBy: ADMIN_ID })).toEqual(first);
    await ds.unmark({ personId: "m-3", serviceDate: SUNDAY, by: TEAM_ID, isCorrection: false });
    expect(api.requests.filter((r) => r.method !== "GET").length).toBe(writesAfterFirst);
  });

  it("looks up the current row by Person ID before writing, even if rows moved", async () => {
    const { api, ds } = setup();
    await ds.getRoster(SUNDAY);
    api.insertRowAtTop(MEMBERS, member("m-9", "Inserted", "Person", 2045550109));
    await ds.markPresent({
      personId: "m-2",
      serviceDate: SUNDAY,
      markedBy: TEAM_ID,
      isCorrection: false,
    });
    const rows = api.tab(MEMBERS);
    expect(rows.find((r) => r[2] === "m-2")?.[6]).toBe("Yes");
    expect(rows.find((r) => r[2] === "m-9")?.[6]).toBe("No");
  });

  it("adds a newcomer as one row in the exact sheet formats", async () => {
    const { api, ds } = setup();
    const added = await ds.addNewcomer(newcomerInput());
    expect(added.id).toBe("11111111-2222-4333-8444-555555555555");
    const row = api.tab(NEWCOMERS).at(-1);
    expect(row).toEqual([
      "11111111-2222-4333-8444-555555555555",
      SUNDAY,
      "Adebayo",
      "Ogunleye",
      "adebayo@example.com",
      "2045550148",
      "Friend",
      "Tunde Bakare",
      "Yes",
      "September 14",
      "Nurse",
      "Yes",
      "No",
    ]);
    // The unmapped "Prayer Request" column (index 13) is not part of the written row at all.
    const append = api.requests.find((r) => r.method === "POST");
    expect((append?.body as { values: CellValue[][] }).values[0]).toHaveLength(13);
  });

  it("writes non-friend follow-ups after the chip label", async () => {
    const { api, ds } = setup();
    await ds.addNewcomer(
      newcomerInput({
        heardVia: { source: "social_media", detail: "Instagram" },
        consentToMessages: false,
      }),
    );
    const row = api.tab(NEWCOMERS).at(-1);
    expect(row?.[6]).toBe("Social media: Instagram");
    expect(row?.[7]).toBe("");
    expect(row?.[11]).toBe("No");
  });

  it("stores formula-looking input as plain text", async () => {
    const { api, ds } = setup();
    const formula = '=HYPERLINK("http://example.com","click")';
    await ds.addNewcomer(newcomerInput({ firstName: formula, occupation: "+SUM(A1:A9)" }));
    const row = api.tab(NEWCOMERS).at(-1);
    expect(row?.[2]).toBe(formula);
    expect(row?.[10]).toBe("+SUM(A1:A9)");
  });

  it("refuses a newcomer whose phone is already on either list", async () => {
    const { ds } = setup();
    const error = await ds
      .addNewcomer(newcomerInput({ phone: "+12045550103" }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicatePhoneError);
    expect((error as DuplicatePhoneError).existing.id).toBe("m-3");
  });

  it("never adds rows to the members tab", async () => {
    const { api, ds } = setup();
    const before = api.tab(MEMBERS).length;
    await ds.addNewcomer(newcomerInput());
    await ds.markPresent({
      personId: "m-2",
      serviceDate: SUNDAY,
      markedBy: TEAM_ID,
      isCorrection: false,
    });
    expect(api.tab(MEMBERS).length).toBe(before);
    expect(
      api.requests.some((r) => r.method === "POST" && r.ranges[0]?.startsWith(`'Template "26'`)),
    ).toBe(false);
  });

  it("uses valueInputOption RAW for every write", async () => {
    const { api, ds } = setup();
    await ds.markPresent({
      personId: "m-2",
      serviceDate: SUNDAY,
      markedBy: TEAM_ID,
      isCorrection: false,
    });
    await ds.unmark({ personId: "m-1", serviceDate: SUNDAY, by: TEAM_ID, isCorrection: false });
    await ds.addNewcomer(newcomerInput());
    const writes = api.requests.filter((r) => r.method !== "GET");
    expect(writes.length).toBeGreaterThanOrEqual(5);
    for (const write of writes) {
      expect(write.valueInputOption).toBe("RAW");
      expect(write.url).not.toContain("USER_ENTERED");
    }
  });
});
