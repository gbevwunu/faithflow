import "server-only";

import type { SignInDecision } from "@/lib/rules";

/**
 * Logs a sign-in decision with ids only: the team member id and church slug on success, the
 * refusal reason and church slug on refusal. Never the email or name.
 */
export function logSignInDecision(decision: SignInDecision, church: string | null): void {
  if (decision.ok) {
    console.info("Sign-in", { church, teamMemberId: decision.member.id });
  } else {
    console.warn("Sign-in refused", { church, reason: decision.reason });
  }
}
