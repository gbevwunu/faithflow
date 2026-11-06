import "server-only";

import { checkRateLimit } from "@vercel/firewall";
import { realSignInEnabled } from "./auth-mode";

/** Rule ids, each matching a Vercel Firewall rule with the `@vercel/firewall` condition. */
export const RATE_LIMIT_RULES = {
  phoneLookup: "phone-lookup",
  signIn: "sign-in",
} as const;

export type RateLimitRule = (typeof RATE_LIMIT_RULES)[keyof typeof RATE_LIMIT_RULES];

const CHECK_TIMEOUT_MS = 1000;

export interface RateLimitDeps {
  check: typeof checkRateLimit;
  env: Record<string, string | undefined>;
}

const defaultDeps: RateLimitDeps = { check: checkRateLimit, env: process.env };

/**
 * Whether this request is over the Vercel Firewall limit for a rule. Checked on production
 * only. If the check fails or times out the request is let through and only the error name is
 * logged, so a firewall problem can never lock volunteers out on a Sunday.
 */
export async function isRateLimited(
  rule: RateLimitRule,
  options: { headers: Headers; rateLimitKey?: string },
  deps: RateLimitDeps = defaultDeps,
): Promise<boolean> {
  if (!realSignInEnabled(deps.env)) return false;
  try {
    const result = await deps.check(rule, { ...options, timeout: CHECK_TIMEOUT_MS });
    if (result.error === "not-found") {
      console.warn("Rate limit rule not found", { rule });
      return false;
    }
    return result.rateLimited || result.error === "blocked";
  } catch (error) {
    console.error("Rate limit check failed", {
      rule,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

/** Phone lookups are limited per team member, whatever network they are on. */
export function phoneLookupKey(church: string, teamMemberId: string): string {
  return `phone:${church}:${teamMemberId}`;
}
