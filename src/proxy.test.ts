import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

function run(host: string, path: string, method = "GET") {
  const request = new NextRequest(`http://${host}${path}`, { method, headers: { host } });
  const response = proxy(request);
  return {
    status: response.status,
    location: response.headers.get("location"),
    rewrite: response.headers.get("x-middleware-rewrite"),
    next: response.headers.get("x-middleware-next"),
  };
}

const rewrittenPath = (rewrite: string | null) => (rewrite ? new URL(rewrite).pathname : null);

beforeEach(() => vi.stubEnv("ROOT_DOMAIN", "faithflow.app"));
afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("rewrites a church subdomain to the church's routes, keeping the visible URL", () => {
    const result = run("newbreed.faithflow.app", "/attendance");
    expect(rewrittenPath(result.rewrite)).toBe("/newbreed/attendance");
    expect(result.location).toBeNull();
  });

  it("rewrites the subdomain root and nested pages", () => {
    expect(rewrittenPath(run("newbreed.faithflow.app", "/").rewrite)).toBe("/newbreed");
    expect(rewrittenPath(run("newbreed.faithflow.app", "/newcomers/new").rewrite)).toBe(
      "/newbreed/newcomers/new",
    );
  });

  it("keeps the query string when rewriting", () => {
    const { rewrite } = run("newbreed.faithflow.app", "/attendance?x=1");
    expect(rewrite && new URL(rewrite).search).toBe("?x=1");
  });

  it("rewrites server action POSTs on a subdomain too", () => {
    expect(rewrittenPath(run("newbreed.faithflow.app", "/attendance", "POST").rewrite)).toBe(
      "/newbreed/attendance",
    );
  });

  it("leaves already-prefixed paths alone on the church's own subdomain", () => {
    const result = run("newbreed.faithflow.app", "/newbreed/attendance");
    expect(result.rewrite).toBeNull();
    expect(result.next).toBe("1");
  });

  it("pins the church: another church's path on a subdomain stays inside that church", () => {
    expect(rewrittenPath(run("newbreed.faithflow.app", "/other/attendance").rewrite)).toBe(
      "/newbreed/other/attendance",
    );
  });

  it("rewrites unknown church subdomains without redirecting, so the layout can 404", () => {
    const result = run("nosuchchurch.faithflow.app", "/attendance");
    expect(rewrittenPath(result.rewrite)).toBe("/nosuchchurch/attendance");
    expect(result.status).not.toBeGreaterThanOrEqual(300);
    expect(result.location).toBeNull();
  });

  it("supports local development subdomains", () => {
    expect(rewrittenPath(run("newbreed.localhost:3000", "/attendance").rewrite)).toBe(
      "/newbreed/attendance",
    );
  });

  it.each([
    ["the bare root domain", "faithflow.app"],
    ["www", "www.faithflow.app"],
    ["a Vercel preview", "faithflow-git-feature-team.vercel.app"],
    ["localhost", "localhost:3000"],
    ["a forged foreign host", "newbreed.evil.com"],
  ])("passes %s through to path-based routing", (_label, host) => {
    const result = run(host, "/newbreed/attendance");
    expect(result.rewrite).toBeNull();
    expect(result.location).toBeNull();
    expect(result.next).toBe("1");
  });

  it("does nothing for subdomains when ROOT_DOMAIN is unset", () => {
    vi.stubEnv("ROOT_DOMAIN", "");
    expect(run("newbreed.faithflow.app", "/attendance").rewrite).toBeNull();
  });

  it("never redirects", () => {
    for (const [host, path] of [
      ["newbreed.faithflow.app", "/attendance"],
      ["newbreed.faithflow.app", "//evil.com/attendance"],
      ["faithflow.app", "/"],
      ["evil.com", "/newbreed"],
    ] as const) {
      expect(run(host, path).location).toBeNull();
    }
  });
});
