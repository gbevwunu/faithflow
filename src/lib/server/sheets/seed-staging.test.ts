import { describe, expect, it } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { createSheetsClient } from "./client";
import { SeedRefusedError, seedStagingSheet } from "./seed-staging";
import { createFakeSheetsApi } from "./testing/fake-sheets-api";

const config = getChurchConfig("newbreed");
if (config.dataSource.type !== "google-sheets") throw new Error("expected google-sheets config");
const layout = config.dataSource;

const memberHeader = [
  "Last Name",
  "Immigration Status",
  "Person ID",
  "Phone Number",
  "First Name",
  "Attended Church",
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup(title: string, extraMemberRows: (string | number)[][] = []) {
  const api = createFakeSheetsApi({
    title,
    tabs: {
      'Template "26': [memberHeader, ...extraMemberRows],
      "New Comers 2026": [newcomerHeader],
      "Tick Log": [tickLogHeader],
    },
  });
  const client = createSheetsClient({
    spreadsheetId: "staging",
    getAccessToken: async () => "token",
    fetch: api.fetch,
  });
  return { api, run: () => seedStagingSheet({ client, layout, firstVisitDate: "2026-10-04" }) };
}

describe("seedStagingSheet", () => {
  it("refuses a spreadsheet whose title does not contain STAGING, before reading any rows", async () => {
    const { api, run } = setup("NewBreed Attendance 2026");
    await expect(run()).rejects.toThrow(SeedRefusedError);
    await expect(run()).rejects.toThrow(/STAGING/);
    expect(api.requests.every((r) => r.ranges.length === 0)).toBe(true);
    expect(api.requests.some((r) => r.method !== "GET")).toBe(false);
  });

  it("refuses a staging sheet that already has data rows", async () => {
    const { api, run } = setup("NewBreed STAGING", [["Existing", "", "", "", "", ""]]);
    await expect(run()).rejects.toThrow("Refused: the sheet already has data rows.");
    expect(api.requests.some((r) => r.method !== "GET")).toBe(false);
  });

  it("fills an empty staging sheet with fake people only", async () => {
    const { api, run } = setup("NewBreed STAGING");
    expect(await run()).toEqual({ members: 30, newcomers: 8 });

    const members = api.tab('Template "26').slice(1);
    const newcomers = api.tab("New Comers 2026").slice(1);
    expect(members).toHaveLength(30);
    expect(newcomers).toHaveLength(8);

    const ids = [...members.map((r) => r[2]), ...newcomers.map((r) => r[0])];
    for (const id of ids) expect(String(id)).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);

    const phones = [...members.map((r) => r[3]), ...newcomers.map((r) => r[5])];
    for (const phone of phones) expect(String(phone)).toMatch(/^1?20455501\d\d$/);

    // Immigration Status is never written.
    for (const row of members) expect(row[1]).toBe("");
    for (const write of api.requests.filter((r) => r.method !== "GET")) {
      expect(write.valueInputOption).toBe("RAW");
    }
    expect(api.tab("Tick Log")).toHaveLength(1);
  });
});
