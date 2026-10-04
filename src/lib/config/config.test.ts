import { describe, expect, it } from "vitest";
import {
  InvalidChurchConfigError,
  UnknownChurchError,
  churchConfigSchema,
  getChurchConfig,
  getTeamMemberName,
  parseChurchConfig,
} from "@/lib/config";
import { newbreed } from "@/lib/config/churches/newbreed";

describe("church config", () => {
  it("accepts the NewBreed config", () => {
    const config = getChurchConfig("newbreed");
    expect(config.displayName).toBe("The NewBreed Church");
    expect(config.timezone).toBe("America/Winnipeg");
    expect(config.dataSource.type).toBe("mock");
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

  it("requires sheet details for a google-sheets data source", () => {
    const raw = { ...newbreed, dataSource: { type: "google-sheets" } };
    expect(churchConfigSchema.safeParse(raw).success).toBe(false);
  });

  it("requires a UUID id on every team member, unique within the team", () => {
    const [first, second] = newbreed.team;
    if (!first || !second) throw new Error("Expected two seeded team members");
    const missingId = { ...newbreed, team: [{ ...first, id: "not-a-uuid" }] };
    const duplicateIds = { ...newbreed, team: [first, { ...second, id: first.id }] };
    expect(churchConfigSchema.safeParse(missingId).success).toBe(false);
    expect(churchConfigSchema.safeParse(duplicateIds).success).toBe(false);
  });
});

describe("getTeamMemberName", () => {
  const config = getChurchConfig("newbreed");

  it("resolves a team member id to their display name", () => {
    for (const member of config.team) {
      expect(getTeamMemberName(config, member.id)).toBe(member.name);
    }
  });

  it("returns null for an id not on the team", () => {
    expect(getTeamMemberName(config, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
