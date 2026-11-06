import { z } from "zod";
import type { TeamList, TeamMember } from "@/lib/config/schema";
import { findTeamMemberByEmail } from "@/lib/config/team";

/** A sign-in lasts 12 hours from the moment it happened, however much the app is used. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Allowed clock difference between instances when checking a sign-in time from the future. */
const CLOCK_SKEW_MS = 60_000;

export type SignInRefusalReason =
  "wrong-provider" | "email-not-verified" | "not-a-church-host" | "not-on-team";

export type SignInDecision =
  { ok: true; member: TeamMember } | { ok: false; reason: SignInRefusalReason };

export interface SignInAttempt {
  provider: string | undefined;
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
  /** The church chosen by the request's validated Host, or null when it is not a church host. */
  church: string | null;
  /** That church's current team list. */
  team: TeamList;
}

/**
 * Whether a Google sign-in may go ahead: a verified Google email on the current team list of
 * the church whose subdomain the sign-in came through.
 */
export function decideSignIn(attempt: SignInAttempt): SignInDecision {
  if (attempt.provider !== "google") return { ok: false, reason: "wrong-provider" };
  if (attempt.church === null) return { ok: false, reason: "not-a-church-host" };
  if (attempt.emailVerified !== true || !attempt.email) {
    return { ok: false, reason: "email-not-verified" };
  }
  const member = findTeamMemberByEmail(attempt.team, attempt.email);
  return member ? { ok: true, member } : { ok: false, reason: "not-on-team" };
}

/** What the session token proves: who signed in, for which church, and when. No role or id. */
export const sessionClaimsSchema = z.object({
  church: z.string().min(1),
  email: z.string().min(1),
  signedInAt: z.number().int().nonnegative(),
});

export type SessionClaims = z.infer<typeof sessionClaimsSchema>;

export type SessionResolution =
  | { status: "signed-in"; member: TeamMember }
  /** A valid sign-in for this church whose email is no longer on the team list. */
  | { status: "not-on-team" }
  | { status: "signed-out" };

/**
 * Resolves a session for one church on every request. The member's id, name and role come
 * from the team list as it is now, so removing someone or changing their role applies on
 * their next request. A sign-in for another church, or one older than 12 hours, is signed out.
 */
export function resolveSession(
  claims: unknown,
  context: { church: string; team: TeamList; now: Date },
): SessionResolution {
  const parsed = sessionClaimsSchema.safeParse(claims);
  if (!parsed.success) return { status: "signed-out" };
  const { church, email, signedInAt } = parsed.data;

  if (church !== context.church) return { status: "signed-out" };
  const age = context.now.getTime() - signedInAt;
  if (age >= SESSION_MAX_AGE_SECONDS * 1000 || age < -CLOCK_SKEW_MS) {
    return { status: "signed-out" };
  }

  const member = findTeamMemberByEmail(context.team, email);
  return member ? { status: "signed-in", member } : { status: "not-on-team" };
}

/** The sign-in page's `error` value when a sign-in attempt was rate limited. */
export const SIGN_IN_RATE_LIMITED_ERROR = "RateLimited";

export type SignInScreenState =
  | { kind: "signed-in" }
  | { kind: "sign-in" }
  | { kind: "not-on-team" }
  | { kind: "rate-limited" }
  | { kind: "failed" }
  | { kind: "wrong-host" }
  | { kind: "unavailable" };

/**
 * What the sign-in screen shows. Real sign-in only exists on production, and only on the
 * church's own subdomain, where its Google redirect address is registered.
 */
export function getSignInScreenState(input: {
  realSignIn: boolean;
  onChurchHost: boolean;
  session: SessionResolution["status"];
  error: string | undefined;
}): SignInScreenState {
  if (!input.realSignIn) return { kind: "unavailable" };
  if (input.session === "signed-in") return { kind: "signed-in" };
  if (input.session === "not-on-team" || input.error === "AccessDenied") {
    return { kind: "not-on-team" };
  }
  if (!input.onChurchHost) return { kind: "wrong-host" };
  if (input.error === SIGN_IN_RATE_LIMITED_ERROR) return { kind: "rate-limited" };
  if (input.error) return { kind: "failed" };
  return { kind: "sign-in" };
}
