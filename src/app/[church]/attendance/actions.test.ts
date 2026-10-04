import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { createMockDataSource, type DataSource } from "@/lib/data";
import { loadAttendanceScreen } from "@/lib/server/attendance-screen";
import { toClientRoster } from "@/lib/server/client-roster";
import { DEV_NOW_COOKIE, DEV_ROLE_COOKIE } from "@/lib/server/dev-tools";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

let dataSource: DataSource;
vi.mock("@/lib/server/data-source", () => ({ getDataSource: () => dataSource }));

const { markPresentAction, unmarkAction } = await import("./actions");

const config = getChurchConfig("newbreed");
const teamMember = config.team.find((m) => m.role === "team")!;
const admin = config.team.find((m) => m.role === "admin")!;

// Sunday October 4, 2026 in Winnipeg (CDT, UTC-5).
const SUNDAY = "2026-10-04";
const AT_4_59_PM = "2026-10-04T21:59:00.000Z";
const AT_5_00_PM = "2026-10-04T22:00:00.000Z";
const AT_6_00_PM = "2026-10-04T23:00:00.000Z";
const AT_7_00_PM = "2026-10-05T00:00:00.000Z";

function signInAs(role: "team" | "admin", now: string) {
  cookieJar.set(DEV_ROLE_COOKIE, role);
  cookieJar.set(DEV_NOW_COOKIE, now);
}

async function someMemberId(): Promise<string> {
  const roster = await dataSource.getRoster(SUNDAY);
  return roster.find((e) => e.person.list === "member")!.person.id;
}

async function markOf(personId: string) {
  return (await dataSource.getRoster(SUNDAY)).find((e) => e.person.id === personId)?.mark ?? null;
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

describe("markPresentAction", () => {
  it("allows team before the lock and records the session's team member", async () => {
    signInAs("team", AT_4_59_PM);
    const personId = await someMemberId();

    const result = await markPresentAction({ church: "newbreed", personId });

    expect(result).toEqual({
      ok: true,
      mark: { markedByName: teamMember.name, markedAt: AT_4_59_PM },
    });
    expect(await markOf(personId)).toMatchObject({ markedBy: teamMember.id, isCorrection: false });
  });

  it("refuses team at and after the 5:00 PM lock", async () => {
    signInAs("team", AT_5_00_PM);
    const personId = await someMemberId();

    const result = await markPresentAction({ church: "newbreed", personId });

    expect(result).toMatchObject({ ok: false, code: "window-closed" });
    expect(await markOf(personId)).toBeNull();
  });

  it("allows admin during corrections and flags the mark as a correction", async () => {
    signInAs("admin", AT_6_00_PM);
    const personId = await someMemberId();

    const result = await markPresentAction({ church: "newbreed", personId });

    expect(result).toEqual({
      ok: true,
      mark: { markedByName: admin.name, markedAt: AT_6_00_PM },
    });
    expect(await markOf(personId)).toMatchObject({ markedBy: admin.id, isCorrection: true });
  });

  it("refuses admin at 7:00 PM", async () => {
    signInAs("admin", AT_7_00_PM);
    const result = await markPresentAction({ church: "newbreed", personId: await someMemberId() });
    expect(result).toMatchObject({ ok: false, code: "window-closed" });
  });

  it("refuses everyone on a Monday", async () => {
    signInAs("admin", "2026-10-05T15:00:00.000Z");
    const result = await markPresentAction({ church: "newbreed", personId: await someMemberId() });
    expect(result).toMatchObject({ ok: false, code: "window-closed" });
  });

  it("refuses an unknown person id", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await markPresentAction({
      church: "newbreed",
      personId: "00000000-0000-4000-8000-000000000000",
    });
    expect(result).toMatchObject({ ok: false, code: "not-on-roster" });
  });

  it("ignores any markedBy sent from the client", async () => {
    signInAs("team", AT_4_59_PM);
    const personId = await someMemberId();

    const result = await markPresentAction({
      church: "newbreed",
      personId,
      markedBy: admin.id,
      by: admin.id,
    });

    expect(result).toMatchObject({ ok: true, mark: { markedByName: teamMember.name } });
    expect(await markOf(personId)).toMatchObject({ markedBy: teamMember.id });
  });

  it("rejects invalid input", async () => {
    signInAs("team", AT_4_59_PM);
    for (const input of [
      null,
      "x",
      {},
      { church: "newbreed" },
      { church: "newbreed", personId: 42 },
    ]) {
      expect(await markPresentAction(input)).toMatchObject({ ok: false, code: "invalid-input" });
    }
  });

  it("rejects an unknown church", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await markPresentAction({ church: "nope", personId: await someMemberId() });
    expect(result).toMatchObject({ ok: false, code: "unknown-church" });
  });

  it("returns no team member ids, phones or emails to the browser", async () => {
    signInAs("team", AT_4_59_PM);
    const result = await markPresentAction({ church: "newbreed", personId: await someMemberId() });
    const json = JSON.stringify(result);
    expect(json).not.toContain(teamMember.id);
    expect(json).not.toContain(teamMember.email);
    expect(json).not.toMatch(/\+1\d{10}/);
  });
});

describe("unmarkAction", () => {
  it("lets team unmark before the lock and refuses after it", async () => {
    signInAs("team", AT_4_59_PM);
    const personId = await someMemberId();
    await markPresentAction({ church: "newbreed", personId });

    signInAs("team", AT_5_00_PM);
    expect(await unmarkAction({ church: "newbreed", personId })).toMatchObject({
      ok: false,
      code: "window-closed",
    });
    expect(await markOf(personId)).not.toBeNull();

    signInAs("admin", AT_6_00_PM);
    expect(await unmarkAction({ church: "newbreed", personId })).toEqual({ ok: true, mark: null });
    expect(await markOf(personId)).toBeNull();
  });
});

describe("session and clock guards", () => {
  it("has no session, and ignores the fake clock, outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    signInAs("admin", AT_6_00_PM);
    const result = await markPresentAction({ church: "newbreed", personId: await someMemberId() });
    expect(result).toMatchObject({ ok: false, code: "not-signed-in" });
  });

  it("allows the fake session on a preview deployment with DEV_FAKE_SESSION=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DEV_FAKE_SESSION", "true");
    signInAs("team", AT_4_59_PM);
    const result = await markPresentAction({ church: "newbreed", personId: await someMemberId() });
    expect(result).toMatchObject({ ok: true });
  });

  it("refuses to run the fake session on a production deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEV_FAKE_SESSION", "true");
    signInAs("admin", AT_6_00_PM);
    await expect(
      markPresentAction({ church: "newbreed", personId: await someMemberId() }),
    ).rejects.toThrow(/production deployment/);
  });
});

describe("roster data sent to the browser", () => {
  async function screenJson(role: "team" | "admin") {
    const session = {
      teamMemberId: role === "team" ? teamMember.id : admin.id,
      role,
      name: role === "team" ? teamMember.name : admin.name,
    } as const;
    await dataSource.markPresent({
      personId: await someMemberId(),
      serviceDate: SUNDAY,
      markedBy: admin.id,
      isCorrection: false,
    });
    const data = await loadAttendanceScreen(config, session, new Date(AT_4_59_PM), dataSource);
    return { data, json: JSON.stringify(data) };
  }

  it("contains no full phone numbers, emails or team member ids", async () => {
    const { data, json } = await screenJson("team");
    expect(data.roster.length).toBeGreaterThan(0);
    expect(json).not.toMatch(/\+1\d{10}/);
    expect(json).not.toContain("@");
    for (const { person } of await dataSource.getRoster(SUNDAY)) {
      expect(json).not.toContain(person.phone.slice(-10));
      expect(json).not.toContain(person.phone.slice(-7));
    }
    for (const member of config.team) {
      expect(json).not.toContain(member.id);
    }
  });

  it("sends only the allowed fields per roster entry", async () => {
    const { data } = await screenJson("admin");
    for (const entry of data.roster) {
      expect(Object.keys(entry).sort()).toEqual(
        ["firstName", "id", "lastName", "list", "mark", "phoneLast4"].sort(),
      );
      expect(entry.phoneLast4).toMatch(/^\d{4}$/);
      if (entry.mark) {
        expect(Object.keys(entry.mark).sort()).toEqual(["markedAt", "markedByName"]);
      }
    }
    expect(data.roster.some((e) => e.mark?.markedByName === admin.name)).toBe(true);
  });

  it("toClientRoster drops newcomer details such as birthday, occupation and consent", async () => {
    const roster = await dataSource.getRoster(SUNDAY);
    const json = JSON.stringify(toClientRoster(roster, config));
    for (const key of [
      "birthday",
      "occupation",
      "heardVia",
      "consentToMessages",
      "optedOut",
      "email",
      'phone"',
    ]) {
      expect(json).not.toContain(key);
    }
  });
});
