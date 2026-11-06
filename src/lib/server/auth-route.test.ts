import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleAuthRoute, type AuthRouteDeps } from "./auth-route";

function request(path: string, method = "GET") {
  return new NextRequest(`https://newbreed.faithflow.app/api/auth/${path}`, { method });
}

function deps(overrides: Partial<AuthRouteDeps> = {}) {
  const handle = vi.fn(async () => new Response("handled"));
  const rateLimited = vi.fn(async () => false);
  return { env: { VERCEL_ENV: "production" }, handle, rateLimited, ...overrides };
}

describe("handleAuthRoute", () => {
  it("does not exist outside production", async () => {
    for (const env of [{}, { VERCEL_ENV: "preview" }]) {
      const d = deps({ env });
      expect((await handleAuthRoute(request("callback/google"), d)).status).toBe(404);
      expect(d.handle).not.toHaveBeenCalled();
    }
  });

  it("serves the Google sign-in, callback, CSRF and sign-out routes", async () => {
    for (const [path, method] of [
      ["callback/google", "GET"],
      ["csrf", "GET"],
      ["signin/google", "POST"],
      ["signout", "POST"],
    ]) {
      const d = deps();
      expect((await handleAuthRoute(request(path!, method), d)).status).toBe(200);
      expect(d.handle).toHaveBeenCalledOnce();
    }
  });

  it("answers 404 for every other Auth.js route", async () => {
    for (const [path, method] of [
      ["session", "GET"],
      ["providers", "GET"],
      ["signin", "GET"],
      ["callback/github", "GET"],
      ["callback/google", "PUT"],
      ["signout", "GET"],
    ]) {
      const d = deps();
      expect((await handleAuthRoute(request(path!, method), d)).status).toBe(404);
      expect(d.handle).not.toHaveBeenCalled();
    }
  });

  it("rate limits sign-in attempts with 429", async () => {
    for (const [path, method] of [
      ["signin/google", "POST"],
      ["callback/google", "GET"],
    ]) {
      const d = deps({ rateLimited: vi.fn(async () => true) });
      expect((await handleAuthRoute(request(path!, method), d)).status).toBe(429);
      expect(d.handle).not.toHaveBeenCalled();
    }
  });

  it("does not count CSRF or sign-out against the sign-in limit", async () => {
    const d = deps({ rateLimited: vi.fn(async () => true) });
    expect((await handleAuthRoute(request("csrf"), d)).status).toBe(200);
    expect((await handleAuthRoute(request("signout", "POST"), d)).status).toBe(200);
    expect(d.rateLimited).not.toHaveBeenCalled();
  });
});
