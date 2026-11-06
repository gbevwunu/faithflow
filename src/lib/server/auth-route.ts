import "server-only";

import type { NextRequest } from "next/server";
import { realSignInEnabled } from "./auth-mode";
import { RATE_LIMIT_RULES, isRateLimited } from "./rate-limit";

const AUTH_BASE = "/api/auth/";

/** The only Auth.js routes the Google sign-in flow needs; everything else answers 404. */
const ALLOWED_ROUTES: Readonly<Record<string, readonly string[]>> = {
  GET: ["callback/google", "csrf"],
  POST: ["signin/google", "signout"],
};

/** Routes that count as sign-in attempts against the per-IP limit. */
const SIGN_IN_ROUTES: ReadonlySet<string> = new Set(["signin/google", "callback/google"]);

export interface AuthRouteDeps {
  env: Record<string, string | undefined>;
  handle: (request: NextRequest) => Promise<Response>;
  rateLimited: (request: NextRequest) => Promise<boolean>;
}

/**
 * Serves Auth.js routes on production only. Previews and local development have no sign-in
 * routes at all, since they use the fake session.
 */
export async function handleAuthRoute(
  request: NextRequest,
  deps: AuthRouteDeps,
): Promise<Response> {
  if (!realSignInEnabled(deps.env)) return notFound();

  const { pathname } = request.nextUrl;
  const route = pathname.startsWith(AUTH_BASE) ? pathname.slice(AUTH_BASE.length) : "";
  if (!ALLOWED_ROUTES[request.method]?.includes(route)) return notFound();

  if (SIGN_IN_ROUTES.has(route) && (await deps.rateLimited(request))) {
    return new Response("Too many sign-in attempts. Wait a few minutes and try again.", {
      status: 429,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return deps.handle(request);
}

/** Sign-in attempts are limited per client IP. */
export function signInRateLimited(request: { headers: Headers }): Promise<boolean> {
  return isRateLimited(RATE_LIMIT_RULES.signIn, { headers: request.headers });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}
