import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { DEV_TEAM } from "./dev-team";
import { getTeam } from "./team";

const config = getChurchConfig("newbreed");
const realMember = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Real Person",
  email: "real.person@example.com",
  role: "admin",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("getTeam", () => {
  it("reads the team list from the church's environment variable on production", () => {
    const env = { VERCEL_ENV: "production", NEWBREED_TEAM: JSON.stringify([realMember]) };
    expect(getTeam(config, env)).toEqual([realMember]);
  });

  it("picks up a changed list without restarting", () => {
    const first = { VERCEL_ENV: "production", NEWBREED_TEAM: JSON.stringify([realMember]) };
    expect(getTeam(config, first)).toHaveLength(1);
    expect(getTeam(config, { ...first, NEWBREED_TEAM: "[]" })).toEqual([]);
  });

  it("never uses the fake team on production, even with the dev flag set", () => {
    const env = { VERCEL_ENV: "production", NODE_ENV: "development", DEV_FAKE_SESSION: "true" };
    expect(getTeam(config, env)).toEqual([]);
  });

  it("treats a missing or invalid list as an empty team, logging no contents", () => {
    for (const value of [undefined, "oops", JSON.stringify([{ ...realMember, id: "x" }])]) {
      expect(getTeam(config, { VERCEL_ENV: "production", NEWBREED_TEAM: value })).toEqual([]);
    }
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("NEWBREED_TEAM");
    expect(logged).not.toContain("@");
    expect(logged).not.toContain("Real Person");
  });

  it("uses the fake team with the dev tools on, and no team otherwise", () => {
    expect(getTeam(config, { NODE_ENV: "development" })).toBe(DEV_TEAM);
    expect(getTeam(config, { NODE_ENV: "production", VERCEL_ENV: "preview" })).toEqual([]);
  });
});
