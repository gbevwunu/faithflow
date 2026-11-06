import type { Account, Profile } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/rules";
import { SESSION_COOKIE_NAME, buildAuthConfig, churchForHost } from "./auth";

const MEMBER_ID = "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f";
const ADMIN_ID = "7b8e9f0a-1c2d-4e3f-a4b5-c6d7e8f9a0b1";
const MEMBER_EMAIL = "team.member@example.com";
const STRANGER_EMAIL = "stranger@example.com";
const TEAM = JSON.stringify([
  { id: MEMBER_ID, name: "Test Team Member", email: MEMBER_EMAIL, role: "team" },
  { id: ADMIN_ID, name: "Test Admin", email: "admin@example.com", role: "admin" },
]);

const newbreed = getChurchConfig("newbreed");
const google = { provider: "google", type: "oidc", providerAccountId: "1" } as Account;
const profileFor = (email: string | null, emailVerified = true): Profile => ({
  email,
  email_verified: emailVerified,
  name: "Someone Real",
});

type Callbacks = NonNullable<ReturnType<typeof buildAuthConfig>["callbacks"]>;
const callbacks = (church = newbreed): Callbacks => buildAuthConfig(church).callbacks!;
const signIn = (profile: Profile, church: typeof newbreed | null = newbreed) =>
  buildAuthConfig(church).callbacks!.signIn!({ user: {}, account: google, profile });

let logs: MockInstance[];
const loggedText = () =>
  logs
    .flatMap((spy) => spy.mock.calls)
    .map((call) => JSON.stringify(call))
    .join("\n");

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEWBREED_TEAM", TEAM);
  vi.stubEnv("ROOT_DOMAIN", "faithflow.app");
  logs = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("session settings", () => {
  const config = buildAuthConfig(null);

  it("uses encrypted JWT sessions lasting 12 hours, with no database", () => {
    expect(config.session).toMatchObject({ strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS });
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
    expect(config.adapter).toBeUndefined();
  });

  it("sets an HTTP-only, secure, SameSite=Lax, host-only session cookie", () => {
    expect(SESSION_COOKIE_NAME.startsWith("__Host-")).toBe(true);
    expect(config.cookies?.sessionToken).toEqual({
      name: SESSION_COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    });
    expect(config.cookies?.sessionToken?.options).not.toHaveProperty("domain");
    expect(config.useSecureCookies).toBe(true);
  });

  it("offers Google sign-in only, through the church's sign-in page", () => {
    expect(config.providers.map((p) => (typeof p === "function" ? p().id : p.id))).toEqual([
      "google",
    ]);
    expect(config.pages).toEqual({ signIn: "/sign-in", error: "/sign-in" });
  });
});

describe("churchForHost", () => {
  it("reads the church only from a validated church subdomain", () => {
    expect(churchForHost("newbreed.faithflow.app")?.slug).toBe("newbreed");
    expect(churchForHost("faithflow.app")).toBeNull();
    expect(churchForHost("newbreed.evil.example")).toBeNull();
    expect(churchForHost("nosuchchurch.faithflow.app")).toBeNull();
  });
});

describe("signIn callback", () => {
  it("allows a listed, verified Google account on its church's subdomain", async () => {
    expect(await signIn(profileFor("Team.Member@Example.com"))).toBe(true);
  });

  it("refuses an account that is not on the team list", async () => {
    expect(await signIn(profileFor(STRANGER_EMAIL))).toBe(false);
  });

  it("refuses an unverified email and a sign-in from a non-church host", async () => {
    expect(await signIn(profileFor(MEMBER_EMAIL, false))).toBe(false);
    expect(await signIn(profileFor(MEMBER_EMAIL), null)).toBe(false);
  });

  it("refuses everyone when the team list is missing or invalid", async () => {
    vi.stubEnv("NEWBREED_TEAM", "not json");
    expect(await signIn(profileFor(MEMBER_EMAIL))).toBe(false);
  });
});

describe("sign-in logging", () => {
  it("logs a successful sign-in with the team member id and church only", async () => {
    await signIn(profileFor(MEMBER_EMAIL));
    expect(console.info).toHaveBeenCalledWith("Sign-in", {
      church: "newbreed",
      teamMemberId: MEMBER_ID,
    });
  });

  it("logs a refused sign-in with the reason and church only", async () => {
    await signIn(profileFor(STRANGER_EMAIL));
    await signIn(profileFor(MEMBER_EMAIL, false));
    await signIn(profileFor(MEMBER_EMAIL), null);
    expect(console.warn).toHaveBeenCalledWith("Sign-in refused", {
      church: "newbreed",
      reason: "not-on-team",
    });
    expect(console.warn).toHaveBeenCalledWith("Sign-in refused", {
      church: "newbreed",
      reason: "email-not-verified",
    });
    expect(console.warn).toHaveBeenCalledWith("Sign-in refused", {
      church: null,
      reason: "not-a-church-host",
    });
  });

  it("never logs an email or name, whatever the outcome", async () => {
    await signIn(profileFor(MEMBER_EMAIL));
    await signIn(profileFor("Team.Member@Example.com"));
    await signIn(profileFor(STRANGER_EMAIL));
    await signIn(profileFor(STRANGER_EMAIL, false));
    await signIn(profileFor(MEMBER_EMAIL), null);
    vi.stubEnv("NEWBREED_TEAM", JSON.stringify([{ id: "bad", email: MEMBER_EMAIL }]));
    await signIn(profileFor(MEMBER_EMAIL));

    const text = loggedText();
    expect(logs.some((spy) => spy.mock.calls.length > 0)).toBe(true);
    expect(text).not.toContain("@");
    expect(text.toLowerCase()).not.toContain("team.member");
    expect(text).not.toContain("stranger");
    expect(text).not.toContain("Someone Real");
    expect(text).not.toContain("Test Team Member");
  });

  it("logs Auth.js errors by name only", () => {
    const logger = buildAuthConfig(newbreed).logger!;
    const error = new Error(`Access denied for ${MEMBER_EMAIL}`);
    error.name = "AccessDenied";
    logger.error!(error);
    expect(console.error).toHaveBeenCalledWith("Auth error", { error: "AccessDenied" });
    expect(loggedText()).not.toContain("@");
  });
});

describe("token and session callbacks", () => {
  it("stores only who signed in, for which church, and when", async () => {
    const before = Date.now();
    const token = (await callbacks().jwt!({
      token: { sub: "google-sub", name: "Someone Real", picture: "https://example.com/p.png" },
      user: {},
      account: google,
      profile: profileFor("Team.Member@Example.com"),
      trigger: "signIn",
    })) as JWT;
    expect(Object.keys(token).sort()).toEqual(["church", "email", "signedInAt", "sub"]);
    expect(token).toMatchObject({ church: "newbreed", email: MEMBER_EMAIL });
    expect(token.signedInAt).toBeGreaterThanOrEqual(before);
  });

  it("keeps an existing token unchanged after sign-in", async () => {
    const existing: JWT = { sub: "s", church: "newbreed", email: MEMBER_EMAIL, signedInAt: 1 };
    expect(await callbacks().jwt!({ token: existing, user: {}, trigger: "update" })).toBe(existing);
  });

  it("exposes only the claims and expiry, never a role or team member id", async () => {
    const claims = { church: "newbreed", email: MEMBER_EMAIL, signedInAt: 1 };
    const session = await callbacks().session!({
      session: { expires: "2026-10-05T03:00:00.000Z", user: { email: MEMBER_EMAIL } },
      token: { sub: "s", role: "admin", ...claims },
    } as never);
    expect(session).toEqual({ expires: "2026-10-05T03:00:00.000Z", claims });
  });
});
