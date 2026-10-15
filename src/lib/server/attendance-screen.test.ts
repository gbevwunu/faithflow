import { describe, expect, it } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { loadAttendanceScreen } from "./attendance-screen";
import type { Session } from "./request-context";
import { createSheetsClient, type CellValue } from "./sheets/client";
import { createGoogleSheetsDataSource } from "./sheets/google-sheets-data-source";
import { createFakeSheetsApi } from "./sheets/testing/fake-sheets-api";

const config = getChurchConfig("newbreed");
if (config.dataSource.type !== "google-sheets") throw new Error("expected google-sheets config");
const layout = config.dataSource;

const team = config.team.find((m) => m.role === "team")!;
const admin = config.team.find((m) => m.role === "admin")!;
const asSession = (member: typeof team): Session => ({
  teamMemberId: member.id,
  role: member.role,
  name: member.name,
});

const SUNDAY = "2026-10-04";
const SUNDAY_10AM = new Date("2026-10-04T15:00:00.000Z"); // 10:00 CDT
const MONDAY_10AM = new Date("2026-10-05T15:00:00.000Z");
const WARNING_KEY = "staleMarkWarning";

const memberHeader = ["Person ID", "First Name", "Last Name", "Phone Number", "Attended Church"];
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

function setup(members: CellValue[][], tickLog: CellValue[][] = []) {
  const api = createFakeSheetsApi({
    title: "NewBreed STAGING",
    tabs: {
      'Template "26': [memberHeader, ...members],
      "New Comers 2026": [newcomerHeader],
      "Tick Log": [tickLogHeader, ...tickLog],
    },
  });
  const client = createSheetsClient({
    spreadsheetId: "s",
    getAccessToken: async () => "t",
    fetch: api.fetch,
  });
  const ds = createGoogleSheetsDataSource({
    client,
    layout,
    lockKey: `screen-${Math.random()}`,
    warn: () => {},
  });
  return {
    ds,
    load: (session: Session, now: Date) =>
      loadAttendanceScreen(config, session, now, ds, "/newbreed"),
  };
}

const markOf = (data: Awaited<ReturnType<ReturnType<typeof setup>["load"]>>, id: string) =>
  data.roster.find((e) => e.id === id)?.mark;

describe("stale Attended Church marks", () => {
  it("on Sunday morning, a Yes left from last week shows as not ticked, with a warning for admins only", async () => {
    // Ticked last Sunday and never reset.
    const { load } = setup(
      [
        ["m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"],
        ["m-2", "Tunde", "Bakare", 2045550102, "No"],
      ],
      [["2026-09-27T15:00:00.000Z", "2026-09-27", "m-1", "member", "mark", team.id, "No"]],
    );

    const forAdmin = await load(asSession(admin), SUNDAY_10AM);
    expect(forAdmin.isServiceDay).toBe(true);
    expect(markOf(forAdmin, "m-1")).toBeNull();
    expect(forAdmin.staleMarkWarning).toBe(true);

    const forTeam = await load(asSession(team), SUNDAY_10AM);
    expect(markOf(forTeam, "m-1")).toBeNull();
    expect(forTeam.staleMarkWarning).toBe(false);
  });

  it("a stale person can be ticked fresh, which clears the warning without rewriting the cell", async () => {
    const { ds, load } = setup([["m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"]]);
    expect((await load(asSession(admin), SUNDAY_10AM)).staleMarkWarning).toBe(true);

    await ds.markPresent({
      personId: "m-1",
      serviceDate: SUNDAY,
      markedBy: team.id,
      isCorrection: false,
      markedAt: SUNDAY_10AM,
    });

    const after = await load(asSession(admin), SUNDAY_10AM);
    expect(after.staleMarkWarning).toBe(false);
    expect(markOf(after, "m-1")).toEqual({
      markedByName: team.name,
      markedAt: SUNDAY_10AM.toISOString(),
    });
  });

  it("a fresh tick today shows as ticked, with no warning", async () => {
    const { load } = setup(
      [["m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"]],
      [["2026-10-04T14:30:00.000Z", SUNDAY, "m-1", "member", "mark", team.id, "No"]],
    );
    const data = await load(asSession(admin), SUNDAY_10AM);
    expect(markOf(data, "m-1")).toEqual({
      markedByName: team.name,
      markedAt: "2026-10-04T14:30:00.000Z",
    });
    expect(data.staleMarkWarning).toBe(false);
  });

  it("on a non-service day, a Yes without a tick log entry shows as ticked, with no warning", async () => {
    const { load } = setup([["m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"]]);
    const data = await load(asSession(admin), MONDAY_10AM);
    expect(data.isServiceDay).toBe(false);
    expect(markOf(data, "m-1")).toEqual({ markedByName: null, markedAt: null });
    expect(data[WARNING_KEY]).toBe(false);
  });

  it("never changes the sheet while reading", async () => {
    const api = createFakeSheetsApi({
      title: "NewBreed STAGING",
      tabs: {
        'Template "26': [memberHeader, ["m-1", "Adaeze", "Nnamdi", 2045550101, "Yes"]],
        "New Comers 2026": [newcomerHeader],
        "Tick Log": [tickLogHeader],
      },
    });
    const client = createSheetsClient({
      spreadsheetId: "s",
      getAccessToken: async () => "t",
      fetch: api.fetch,
    });
    const ds = createGoogleSheetsDataSource({
      client,
      layout,
      lockKey: "screen-read",
      warn: () => {},
    });
    await loadAttendanceScreen(config, asSession(admin), SUNDAY_10AM, ds, "/newbreed");
    expect(api.requests.every((r) => r.method === "GET")).toBe(true);
    expect(api.tab('Template "26')[1]?.[4]).toBe("Yes");
  });
});
