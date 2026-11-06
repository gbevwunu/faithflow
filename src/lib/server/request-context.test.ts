import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChurchConfig, type ChurchConfig } from "@/lib/config";
import { DEV_TEAM } from "./dev-team";
import { DEV_ROLE_COOKIE } from "./dev-tools";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

// The Auth.js session as auth() would return it.
let authSession: { claims?: unknown } | null = null;
vi.mock("./auth", () => ({ auth: async () => authSession }));

const { getSession } = await import("./request-context");

const newbreed = getChurchConfig("newbreed");
const grace: ChurchConfig = { ...newbreed, slug: "grace", teamEnv: "GRACE_TEAM" };

const ADMIN = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Real Admin",
  email: "real.admin@example.com",
  role: "admin",
};
const signedIn = (church: string, email = ADMIN.email, signedInAt = Date.now()) => ({
  claims: { church, email, signedInAt },
});

beforeEach(() => {
  cookieJar.clear();
  authSession = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSession on production", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_FAKE_SESSION", "");
    vi.stubEnv("NEWBREED_TEAM", JSON.stringify([ADMIN]));
    vi.stubEnv("GRACE_TEAM", JSON.stringify([ADMIN]));
  });

  it("returns the member from the team list for a valid Google sign-in", async () => {
    authSession = signedIn("newbreed");
    expect(await getSession(newbreed)).toEqual({
      teamMemberId: ADMIN.id,
      role: "admin",
      name: "Real Admin",
    });
  });

  it("is signed out without a Google sign-in, whatever dev cookies are sent", async () => {
    cookieJar.set(DEV_ROLE_COOKIE, "admin");
    expect(await getSession(newbreed)).toBeNull();
  });

  it("refuses loudly if the fake session is requested, instead of falling back to it", async () => {
    vi.stubEnv("DEV_FAKE_SESSION", "true");
    cookieJar.set(DEV_ROLE_COOKIE, "admin");
    authSession = signedIn("newbreed");
    await expect(getSession(newbreed)).rejects.toThrow(/production deployment/);
  });

  it("refuses a sign-in from one church on another church, even for the same person", async () => {
    authSession = signedIn("newbreed");
    expect(await getSession(grace)).toBeNull();
  });

  it("cuts off a member removed from the list on their next request", async () => {
    authSession = signedIn("newbreed");
    expect(await getSession(newbreed)).not.toBeNull();
    vi.stubEnv("NEWBREED_TEAM", "[]");
    expect(await getSession(newbreed)).toBeNull();
  });

  it("applies a role change on the next request", async () => {
    authSession = signedIn("newbreed");
    vi.stubEnv("NEWBREED_TEAM", JSON.stringify([{ ...ADMIN, role: "team" }]));
    expect((await getSession(newbreed))?.role).toBe("team");
  });

  it("ends the session 12 hours after sign-in", async () => {
    authSession = signedIn("newbreed", ADMIN.email, Date.now() - 12 * 60 * 60 * 1000);
    expect(await getSession(newbreed)).toBeNull();
  });
});

describe("getSession outside production", () => {
  it("keeps the fake session for previews and local development", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DEV_FAKE_SESSION", "true");
    authSession = signedIn("newbreed");
    cookieJar.set(DEV_ROLE_COOKIE, "admin");
    const admin = DEV_TEAM.find((m) => m.role === "admin")!;
    expect(await getSession(newbreed)).toEqual({
      teamMemberId: admin.id,
      role: "admin",
      name: admin.name,
    });
  });

  it("has no session at all without the dev tools", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_FAKE_SESSION", "");
    authSession = signedIn("newbreed");
    expect(await getSession(newbreed)).toBeNull();
  });
});
