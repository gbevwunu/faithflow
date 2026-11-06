import { describe, expect, it } from "vitest";
import {
  InvalidTeamListError,
  findTeamMember,
  findTeamMemberByEmail,
  getTeamMemberName,
  parseTeamList,
} from "./team";

const ENV = "NEWBREED_TEAM";
const TEAM_ID = "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f";
const ADMIN_ID = "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1";
const team = (members: unknown[]) => JSON.stringify(members);
const member = {
  id: TEAM_ID,
  name: "Test Team Member",
  email: "team.member@example.com",
  role: "team",
};
const admin = { id: ADMIN_ID, name: "Test Admin", email: "admin@example.com", role: "admin" };

function problemsOf(raw: string | undefined): string {
  try {
    parseTeamList(raw, ENV);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidTeamListError);
    return (error as Error).message;
  }
  throw new Error("expected the team list to be rejected");
}

describe("parseTeamList", () => {
  it("parses a JSON array of team members", () => {
    expect(parseTeamList(team([member, admin]), ENV)).toEqual([member, admin]);
  });

  it("lowercases and trims emails so they match Google's", () => {
    const [parsed] = parseTeamList(team([{ ...member, email: "  Team.Member@Example.COM " }]), ENV);
    expect(parsed?.email).toBe("team.member@example.com");
  });

  it("rejects a missing or empty variable", () => {
    expect(problemsOf(undefined)).toContain("NEWBREED_TEAM");
    expect(problemsOf("  ")).toContain("is not set");
  });

  it("rejects text that is not JSON", () => {
    expect(problemsOf("team.member@example.com,admin")).toContain("not valid JSON");
  });

  it.each([
    ["an id that is not a UUID", { ...member, id: "42" }],
    ["an invalid email", { ...member, email: "not-an-email" }],
    ["an unknown role", { ...member, role: "owner" }],
    ["an empty name", { ...member, name: " " }],
  ])("rejects %s", (_label, bad) => {
    expect(() => parseTeamList(team([bad]), ENV)).toThrow(InvalidTeamListError);
  });

  it("rejects duplicate ids and duplicate emails, ignoring case", () => {
    expect(problemsOf(team([member, { ...admin, id: TEAM_ID }]))).toContain("ids must be unique");
    expect(problemsOf(team([member, { ...admin, email: "TEAM.MEMBER@example.com" }]))).toContain(
      "emails must be unique",
    );
  });

  it("never puts the list's contents in the error", () => {
    const messages = [
      problemsOf(team([{ ...member, email: "not-an-email" }])),
      problemsOf(team([member, { ...admin, email: member.email }])),
      problemsOf(team([{ ...member, id: "42" }])),
      problemsOf(`[{"email":"${member.email}"`),
    ];
    for (const text of messages) {
      expect(text).not.toContain("@");
      expect(text).not.toContain("not-an-email");
      expect(text).not.toContain("Test Team Member");
    }
  });
});

describe("team lookups", () => {
  const list = parseTeamList(team([member, admin]), ENV);

  it("finds members by id and by email in any case", () => {
    expect(findTeamMember(list, ADMIN_ID)?.role).toBe("admin");
    expect(findTeamMemberByEmail(list, " Admin@Example.com ")?.id).toBe(ADMIN_ID);
    expect(findTeamMemberByEmail(list, "someone@example.com")).toBeUndefined();
  });

  it("resolves a team member id to a display name, or null", () => {
    expect(getTeamMemberName(list, TEAM_ID)).toBe("Test Team Member");
    expect(getTeamMemberName(list, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
