import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRateLimited, phoneLookupKey, type RateLimitDeps } from "./rate-limit";

const headers = new Headers({ host: "newbreed.faithflow.app", "x-real-ip": "203.0.113.7" });
const production = { VERCEL_ENV: "production" };

function deps(
  result: Awaited<ReturnType<RateLimitDeps["check"]>> | Error,
  env: Record<string, string | undefined> = production,
) {
  const check = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { check, env } as unknown as RateLimitDeps & { check: typeof check };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("isRateLimited", () => {
  it("asks the Vercel Firewall rule with the key and a timeout on production", async () => {
    const d = deps({ rateLimited: true });
    expect(await isRateLimited("phone-lookup", { headers, rateLimitKey: "k" }, d)).toBe(true);
    expect(d.check).toHaveBeenCalledWith("phone-lookup", {
      headers,
      rateLimitKey: "k",
      timeout: 1000,
    });
  });

  it("allows requests under the limit", async () => {
    expect(await isRateLimited("sign-in", { headers }, deps({ rateLimited: false }))).toBe(false);
  });

  it("does not check at all outside production", async () => {
    for (const env of [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }]) {
      const d = deps({ rateLimited: true }, env);
      expect(await isRateLimited("sign-in", { headers }, d)).toBe(false);
      expect(d.check).not.toHaveBeenCalled();
    }
  });

  it("treats a request the firewall blocked as limited", async () => {
    expect(
      await isRateLimited("sign-in", { headers }, deps({ rateLimited: false, error: "blocked" })),
    ).toBe(true);
  });

  it("lets requests through when the rule is missing, logging the rule only", async () => {
    expect(
      await isRateLimited("sign-in", { headers }, deps({ rateLimited: false, error: "not-found" })),
    ).toBe(false);
    expect(console.warn).toHaveBeenCalledWith("Rate limit rule not found", { rule: "sign-in" });
  });

  it("lets requests through when the check fails or times out", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    expect(await isRateLimited("phone-lookup", { headers, rateLimitKey: "k" }, deps(timeout))).toBe(
      false,
    );
    expect(console.error).toHaveBeenCalledWith("Rate limit check failed", {
      rule: "phone-lookup",
      error: "TimeoutError",
    });
  });
});

describe("phoneLookupKey", () => {
  it("keys phone lookups by church and team member id, never by a phone or email", () => {
    expect(phoneLookupKey("newbreed", "3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f")).toBe(
      "phone:newbreed:3f6c1d2e-8a4b-4c7d-9e5f-1a2b3c4d5e6f",
    );
  });
});
