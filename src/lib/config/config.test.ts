import { describe, expect, it } from "vitest";
import {
  InvalidChurchConfigError,
  UnknownChurchError,
  churchConfigSchema,
  getChurchConfig,
  parseChurchConfig,
} from "@/lib/config";
import { newbreed } from "@/lib/config/churches/newbreed";

describe("church config", () => {
  it("accepts the NewBreed config", () => {
    const config = getChurchConfig("newbreed");
    expect(config.displayName).toBe("The NewBreed Church");
    expect(config.timezone).toBe("America/Winnipeg");
    expect(config.dataSource).toMatchObject({
      type: "google-sheets",
      spreadsheetIdEnv: "NEWBREED_SPREADSHEET_ID",
      members: { tab: 'Template "26' },
      newcomers: { tab: "New Comers 2026" },
      tickLog: { tab: "Tick Log" },
    });
    expect(config.modules).toEqual({
      attendance: true,
      newcomerFollowUp: false,
      membershipJourney: false,
    });
  });

  it("throws UnknownChurchError for an unknown slug", () => {
    expect(() => getChurchConfig("nope")).toThrow(UnknownChurchError);
    expect(() => getChurchConfig("nope")).toThrow(/Unknown church "nope"/);
  });

  it("does not treat inherited object keys as church slugs", () => {
    expect(() => getChurchConfig("toString")).toThrow(UnknownChurchError);
  });

  it("rejects a correctionEndTime earlier than teamLockTime", () => {
    const raw = {
      ...newbreed,
      schedule: { ...newbreed.schedule, teamLockTime: "17:00", correctionEndTime: "16:30" },
    };
    expect(churchConfigSchema.safeParse(raw).success).toBe(false);
    expect(() => parseChurchConfig("newbreed", raw)).toThrow(InvalidChurchConfigError);
    expect(() => parseChurchConfig("newbreed", raw)).toThrow(/schedule\.correctionEndTime/);
  });

  it("accepts a correctionEndTime equal to teamLockTime", () => {
    const raw = {
      ...newbreed,
      schedule: { ...newbreed.schedule, teamLockTime: "17:00", correctionEndTime: "17:00" },
    };
    expect(churchConfigSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects malformed times, colors and timezones", () => {
    const badTime = { ...newbreed, schedule: { ...newbreed.schedule, teamLockTime: "5pm" } };
    const badColor = { ...newbreed, branding: { primaryColor: "purple" } };
    const badZone = { ...newbreed, timezone: "Winnipeg" };
    for (const raw of [badTime, badColor, badZone]) {
      expect(churchConfigSchema.safeParse(raw).success).toBe(false);
    }
  });

  it("never maps a members column to Immigration Status", () => {
    const config = getChurchConfig("newbreed");
    if (config.dataSource.type !== "google-sheets") throw new Error("expected google-sheets");
    expect(Object.values(config.dataSource.members.columns)).not.toContain("Immigration Status");
  });

  it("rejects a spreadsheet ID in place of an environment variable name", () => {
    const raw = {
      ...newbreed,
      dataSource: { ...newbreed.dataSource, spreadsheetIdEnv: "1AbCdEfGhIjKlMnOp" },
    };
    expect(churchConfigSchema.safeParse(raw).success).toBe(false);
  });

  it("requires sheet details for a google-sheets data source", () => {
    const raw = { ...newbreed, dataSource: { type: "google-sheets" } };
    expect(churchConfigSchema.safeParse(raw).success).toBe(false);
  });

  it("names the team list's environment variable instead of listing team members", () => {
    expect(getChurchConfig("newbreed").teamEnv).toBe("NEWBREED_TEAM");
    expect(churchConfigSchema.safeParse({ ...newbreed, teamEnv: "newbreed-team" }).success).toBe(
      false,
    );
    const withoutTeamEnv: Record<string, unknown> = { ...newbreed };
    delete withoutTeamEnv.teamEnv;
    expect(churchConfigSchema.safeParse(withoutTeamEnv).success).toBe(false);
  });

  it("no longer accepts team members in committed config", () => {
    const withTeam = {
      ...newbreed,
      team: [
        {
          id: "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f",
          name: "Test",
          email: "test@example.com",
          role: "team",
        },
      ],
    };
    const parsed = churchConfigSchema.safeParse(withTeam);
    expect(parsed.success && "team" in parsed.data).toBe(false);
  });
  it.each([
    ["a leading hyphen", "-newbreed"],
    ["a trailing hyphen", "newbreed-"],
    ["uppercase letters", "NewBreed"],
    ["an underscore", "new_breed"],
    ["a dot", "new.breed"],
    ["an empty slug", ""],
    ["64 characters", "a".repeat(64)],
  ])("rejects a slug with %s", (_label, slug) => {
    expect(churchConfigSchema.safeParse({ ...newbreed, slug }).success).toBe(false);
  });

  it("accepts slugs that are valid DNS labels", () => {
    for (const slug of ["newbreed", "grace-chapel", "church2", "a".repeat(63)]) {
      expect(churchConfigSchema.safeParse({ ...newbreed, slug }).success).toBe(true);
    }
  });
});
