import { describe, expect, it } from "vitest";
import type { TeamList } from "@/lib/config/schema";
import {
  SESSION_MAX_AGE_SECONDS,
  decideSignIn,
  getSignInScreenState,
  resolveSession,
  type SignInAttempt,
} from "./sign-in";

const team: TeamList = [
  {
    id: "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f",
    name: "Test Team Member",
    email: "team.member@example.com",
    role: "team",
  },
  {
    id: "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1",
    name: "Test Admin",
    email: "admin@example.com",
    role: "admin",
  },
];
const [teamMember, admin] = team as [TeamList[number], TeamList[number]];

const attempt: SignInAttempt = {
  provider: "google",
  email: "Team.Member@example.com",
  emailVerified: true,
  church: "newbreed",
  team,
};

describe("decideSignIn", () => {
  it("allows a verified Google email on the church's team list", () => {
    expect(decideSignIn(attempt)).toEqual({ ok: true, member: teamMember });
  });

  it("refuses an email that is not on the team list", () => {
    expect(decideSignIn({ ...attempt, email: "stranger@example.com" })).toEqual({
      ok: false,
      reason: "not-on-team",
    });
  });

  it("refuses a member of another church: only this church's list counts", () => {
    expect(decideSignIn({ ...attempt, church: "grace", team: [] })).toEqual({
      ok: false,
      reason: "not-on-team",
    });
  });

  it("refuses an unverified or missing email", () => {
    for (const change of [{ emailVerified: false }, { emailVerified: null }, { email: null }]) {
      expect(decideSignIn({ ...attempt, ...change })).toEqual({
        ok: false,
        reason: "email-not-verified",
      });
    }
  });

  it("refuses a sign-in that did not come through a church subdomain", () => {
    expect(decideSignIn({ ...attempt, church: null })).toEqual({
      ok: false,
      reason: "not-a-church-host",
    });
  });

  it("refuses any provider but Google", () => {
    expect(decideSignIn({ ...attempt, provider: "github" })).toEqual({
      ok: false,
      reason: "wrong-provider",
    });
  });
});

describe("resolveSession", () => {
  const now = new Date("2026-10-04T15:00:00.000Z");
  const signedInAt = now.getTime() - 60 * 60 * 1000;
  const claims = { church: "newbreed", email: "admin@example.com", signedInAt };
  const context = { church: "newbreed", team, now };

  it("takes the member's id, name and role from the team list", () => {
    expect(resolveSession(claims, context)).toEqual({ status: "signed-in", member: admin });
  });

  it("applies a role change on the next request", () => {
    const demoted: TeamList = [{ ...admin, role: "team" }];
    expect(resolveSession(claims, { ...context, team: demoted })).toEqual({
      status: "signed-in",
      member: { ...admin, role: "team" },
    });
  });

  it("cuts off a member removed from the list on the next request", () => {
    expect(resolveSession(claims, { ...context, team: [teamMember] })).toEqual({
      status: "not-on-team",
    });
  });

  it("refuses a sign-in for another church", () => {
    expect(resolveSession({ ...claims, church: "grace" }, context)).toEqual({
      status: "signed-out",
    });
  });

  it("ends a session 12 hours after sign-in, however recently it was used", () => {
    const limit = SESSION_MAX_AGE_SECONDS * 1000;
    const at = (age: number) => ({ ...claims, signedInAt: now.getTime() - age });
    expect(resolveSession(at(limit - 1), context).status).toBe("signed-in");
    expect(resolveSession(at(limit), context).status).toBe("signed-out");
  });

  it("refuses a sign-in time from the future beyond clock drift", () => {
    expect(
      resolveSession({ ...claims, signedInAt: now.getTime() + 5 * 60_000 }, context).status,
    ).toBe("signed-out");
  });

  it("treats missing or malformed claims as signed out", () => {
    for (const bad of [
      null,
      undefined,
      {},
      { church: "newbreed", email: "admin@example.com" },
      { ...claims, signedInAt: "yesterday" },
      { ...claims, role: "admin", email: 1 },
    ]) {
      expect(resolveSession(bad, context)).toEqual({ status: "signed-out" });
    }
  });

  it("ignores a role or id placed in the claims", () => {
    const forged = { ...claims, email: "team.member@example.com", role: "admin", id: admin.id };
    expect(resolveSession(forged, context)).toEqual({ status: "signed-in", member: teamMember });
  });
});

describe("getSignInScreenState", () => {
  const base = {
    realSignIn: true,
    onChurchHost: true,
    session: "signed-out" as const,
    error: undefined,
  };

  it("offers Google sign-in on the church's subdomain", () => {
    expect(getSignInScreenState(base)).toEqual({ kind: "sign-in" });
  });

  it("explains a refused sign-in or a removed member", () => {
    expect(getSignInScreenState({ ...base, error: "AccessDenied" })).toEqual({
      kind: "not-on-team",
    });
    expect(getSignInScreenState({ ...base, session: "not-on-team" })).toEqual({
      kind: "not-on-team",
    });
  });

  it("sends a signed-in member on to the app", () => {
    expect(getSignInScreenState({ ...base, session: "signed-in" })).toEqual({
      kind: "signed-in",
    });
  });

  it("explains rate limiting and other failures", () => {
    expect(getSignInScreenState({ ...base, error: "RateLimited" })).toEqual({
      kind: "rate-limited",
    });
    expect(getSignInScreenState({ ...base, error: "Configuration" })).toEqual({ kind: "failed" });
  });

  it("points to the church subdomain from any other host", () => {
    expect(getSignInScreenState({ ...base, onChurchHost: false })).toEqual({
      kind: "wrong-host",
    });
  });

  it("is unavailable outside production", () => {
    expect(getSignInScreenState({ ...base, realSignIn: false, error: "AccessDenied" })).toEqual({
      kind: "unavailable",
    });
  });
});
