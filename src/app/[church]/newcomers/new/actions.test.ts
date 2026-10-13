import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { createMockDataSource, type DataSource, type Person } from "@/lib/data";
import { SHARED_PHONE } from "@/lib/data/mock/seed";
import { DEV_NOW_COOKIE, DEV_ROLE_COOKIE } from "@/lib/server/dev-tools";
import { EMPTY_NEWCOMER_FORM, type NewcomerFormInput } from "@/lib/validation/newcomer";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

let dataSource: DataSource;
vi.mock("@/lib/server/data-source", () => ({ getDataSource: () => dataSource }));

const { addNewcomerAction, checkPhoneAction, tickExistingAction } = await import("./actions");

const config = getChurchConfig("newbreed");
const teamMember = config.team.find((m) => m.role === "team")!;
const admin = config.team.find((m) => m.role === "admin")!;

// Sunday October 4, 2026 in Winnipeg (CDT, UTC-5).
const SUNDAY = "2026-10-04";
const AT_4_59_PM = "2026-10-04T21:59:00.000Z";
const AT_5_00_PM = "2026-10-04T22:00:00.000Z";
const AT_6_00_PM = "2026-10-04T23:00:00.000Z";
const NEW_PHONE = "(204) 555-0190";
const NEW_PHONE_E164 = "+12045550190";

const form: NewcomerFormInput = {
  ...EMPTY_NEWCOMER_FORM,
  firstName: "Tobiloba",
  lastName: "Ajibade",
  phone: NEW_PHONE,
  email: "tobiloba@example.com",
  heardViaSource: "flier",
};

function signInAs(role: "team" | "admin", now: string) {
  cookieJar.set(DEV_ROLE_COOKIE, role);
  cookieJar.set(DEV_NOW_COOKIE, now);
}

async function rosterEntryByPhone(phone: string) {
  return (await dataSource.getRoster(SUNDAY)).find((e) => e.person.phone === phone);
}

async function peopleWithPhone(phone: string): Promise<Person[]> {
  return (await dataSource.getRoster(SUNDAY)).map((e) => e.person).filter((p) => p.phone === phone);
}

beforeEach(() => {
  cookieJar.clear();
  dataSource = createMockDataSource();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_FAKE_SESSION", "");
  vi.stubEnv("VERCEL_ENV", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("addNewcomerAction", () => {
  it("adds the newcomer and marks them present in one action", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await addNewcomerAction({
      church: "newbreed",
      values: {
        ...form,
        firstName: "  Tobiloba ",
        birthdayMonth: "2",
        birthdayDay: "29",
        occupation: " Nurse ",
        heardViaSource: "friend",
        heardViaDetail: "Tunde Bakare",
        consentToMessages: true,
      },
    });

    expect(result).toEqual({ ok: true, marked: true });
    const entry = await rosterEntryByPhone(NEW_PHONE_E164);
    expect(entry?.person).toMatchObject({
      list: "newcomer",
      firstName: "Tobiloba",
      lastName: "Ajibade",
      email: "tobiloba@example.com",
      birthday: { month: 2, day: 29 },
      occupation: "Nurse",
      heardVia: { source: "friend", detail: "Tunde Bakare" },
      firstVisitDate: SUNDAY,
      consentToMessages: true,
      optedOut: false,
    });
    expect(entry?.mark).toMatchObject({
      markedBy: teamMember.id,
      markedAt: AT_4_59_PM,
      isCorrection: false,
    });
  });

  it("stores consent as not given when the box is left unticked", async () => {
    signInAs("team", AT_4_59_PM);
    await addNewcomerAction({ church: "newbreed", values: form });
    const entry = await rosterEntryByPhone(NEW_PHONE_E164);
    expect(entry?.person).toMatchObject({
      consentToMessages: false,
      heardVia: { source: "flier" },
    });
  });

  it("stores spreadsheet-formula-like input as plain text", async () => {
    // Reminder: the Google Sheets data source must write raw values, never parse formulas.
    signInAs("team", AT_4_59_PM);
    const formula = '=HYPERLINK("http://example.com","click")';
    await addNewcomerAction({
      church: "newbreed",
      values: { ...form, firstName: formula, occupation: "+SUM(A1:A9)" },
    });
    const entry = await rosterEntryByPhone(NEW_PHONE_E164);
    expect(entry?.person.firstName).toBe(formula);
    expect(entry?.person).toMatchObject({ occupation: "+SUM(A1:A9)" });
  });

  it.each([
    ["missing first name", { firstName: " " }, "firstName"],
    ["invalid phone", { phone: "555-0190" }, "phone"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["impossible birthday", { birthdayMonth: "2", birthdayDay: "30" }, "birthdayDay"],
    ["no heard-via choice", { heardViaSource: null }, "heardViaSource"],
  ] as const)("rejects %s with a field error and adds nobody", async (_label, overrides, field) => {
    signInAs("team", AT_4_59_PM);
    const before = (await dataSource.getRoster(SUNDAY)).length;
    const result = await addNewcomerAction({
      church: "newbreed",
      values: { ...form, ...overrides },
    });
    expect(result).toMatchObject({ ok: false, code: "invalid-fields" });
    expect(result.ok === false && "fieldErrors" in result && result.fieldErrors).toHaveProperty(
      field,
    );
    expect((await dataSource.getRoster(SUNDAY)).length).toBe(before);
  });

  it("rejects a malformed request", async () => {
    signInAs("team", AT_4_59_PM);
    for (const input of [null, "x", { values: form }, { church: 42, values: form }]) {
      expect(await addNewcomerAction(input)).toMatchObject({ ok: false, code: "invalid-input" });
    }
  });

  it("is refused for team after the lock", async () => {
    signInAs("team", AT_5_00_PM);
    const result = await addNewcomerAction({ church: "newbreed", values: form });
    expect(result).toMatchObject({ ok: false, code: "window-closed" });
    expect(await rosterEntryByPhone(NEW_PHONE_E164)).toBeUndefined();
  });

  it("is allowed for admins during corrections, marked as a correction", async () => {
    signInAs("admin", AT_6_00_PM);
    const result = await addNewcomerAction({ church: "newbreed", values: form });
    expect(result).toEqual({ ok: true, marked: true });
    expect((await rosterEntryByPhone(NEW_PHONE_E164))?.mark).toMatchObject({
      markedBy: admin.id,
      isCorrection: true,
    });
  });

  it("is refused without a session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    signInAs("admin", AT_4_59_PM);
    const result = await addNewcomerAction({ church: "newbreed", values: form });
    expect(result).toMatchObject({ ok: false, code: "not-signed-in" });
  });

  it("refuses a phone already on a list, revealing only first name, last initial and list", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await addNewcomerAction({
      church: "newbreed",
      values: { ...form, phone: SHARED_PHONE },
    });
    expect(result).toEqual({
      ok: false,
      code: "duplicate",
      error: "This number matches Kemi O. on the member list.",
      match: { firstName: "Kemi", lastInitial: "O", list: "member" },
    });
    expect(JSON.stringify(result)).not.toContain("Oladipo");
  });

  it("creates only one newcomer when the same form is submitted twice at once", async () => {
    signInAs("team", AT_4_59_PM);
    const results = await Promise.all([
      addNewcomerAction({ church: "newbreed", values: form }),
      addNewcomerAction({ church: "newbreed", values: form }),
    ]);
    expect(await peopleWithPhone(NEW_PHONE_E164)).toHaveLength(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      expect.objectContaining({
        code: "duplicate",
        match: expect.objectContaining({ list: "newcomer" }),
      }),
    ]);
  });
});

describe("checkPhoneAction", () => {
  it("returns only first name, last initial and list for a match", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await checkPhoneAction({ church: "newbreed", phone: "(204) 555-0118" });
    expect(result).toEqual({
      ok: true,
      status: "match",
      match: { firstName: "Kemi", lastInitial: "O", list: "member" },
    });

    const json = JSON.stringify(result);
    expect(json).not.toContain("Oladipo");
    expect(json).not.toContain(SHARED_PHONE);
    expect(json).not.toContain("@");
    const member = (await dataSource.findByPhone(SHARED_PHONE))!;
    expect(json).not.toContain(member.id);
  });

  it("reports matches on the newcomer list", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await checkPhoneAction({ church: "newbreed", phone: "204-555-0140" });
    expect(result).toEqual({
      ok: true,
      status: "match",
      match: { firstName: "Tobi", lastInitial: "A", list: "newcomer" },
    });
  });

  it("reports available and invalid numbers", async () => {
    signInAs("team", AT_4_59_PM);
    expect(await checkPhoneAction({ church: "newbreed", phone: NEW_PHONE })).toEqual({
      ok: true,
      status: "available",
    });
    expect(await checkPhoneAction({ church: "newbreed", phone: "555" })).toEqual({
      ok: true,
      status: "invalid",
    });
  });

  it("refuses lookups for team after the lock", async () => {
    signInAs("team", AT_5_00_PM);
    expect(await checkPhoneAction({ church: "newbreed", phone: SHARED_PHONE })).toMatchObject({
      ok: false,
      code: "window-closed",
    });
  });

  it("allows lookups for admins during corrections", async () => {
    signInAs("admin", AT_6_00_PM);
    expect(await checkPhoneAction({ church: "newbreed", phone: SHARED_PHONE })).toEqual({
      ok: true,
      status: "match",
      match: { firstName: "Kemi", lastInitial: "O", list: "member" },
    });
  });

  it("refuses lookups on a day with no service", async () => {
    signInAs("admin", "2026-10-05T15:00:00.000Z");
    expect(await checkPhoneAction({ church: "newbreed", phone: SHARED_PHONE })).toMatchObject({
      ok: false,
      code: "window-closed",
    });
  });

  it("refuses lookups without a session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await checkPhoneAction({ church: "newbreed", phone: SHARED_PHONE })).toMatchObject({
      ok: false,
      code: "not-signed-in",
    });
  });
});

describe("tickExistingAction", () => {
  it("marks the existing person with that phone present, by the session's member", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await tickExistingAction({ church: "newbreed", phone: "(204) 555-0118" });
    expect(result).toEqual({
      ok: true,
      match: { firstName: "Kemi", lastInitial: "O", list: "member" },
    });
    const entry = await rosterEntryByPhone(SHARED_PHONE);
    expect(entry?.person.list).toBe("member");
    expect(entry?.mark).toMatchObject({ markedBy: teamMember.id, markedAt: AT_4_59_PM });
  });

  it("is refused for team after the lock", async () => {
    signInAs("team", AT_5_00_PM);
    expect(await tickExistingAction({ church: "newbreed", phone: SHARED_PHONE })).toMatchObject({
      ok: false,
      code: "window-closed",
    });
    expect((await rosterEntryByPhone(SHARED_PHONE))?.mark).toBeNull();
  });

  it("refuses a phone that matches nobody", async () => {
    signInAs("team", AT_4_59_PM);
    expect(await tickExistingAction({ church: "newbreed", phone: NEW_PHONE })).toMatchObject({
      ok: false,
      code: "not-on-roster",
    });
  });
});
