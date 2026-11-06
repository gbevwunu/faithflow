import "server-only";

import type { ChurchConfig } from "@/lib/config";
import { resolveSession, type SessionResolution } from "@/lib/rules";
import { auth } from "./auth";
import type { Session } from "./request-context";
import { getTeam } from "./team";

/**
 * The signed-in Google session resolved for this church against its team list as it is now.
 * Production only; called on every page render and server action.
 */
export async function resolveGoogleSession(config: ChurchConfig): Promise<SessionResolution> {
  const authSession = (await auth()) as { claims?: unknown } | null;
  return resolveSession(authSession?.claims, {
    church: config.slug,
    team: getTeam(config),
    now: new Date(),
  });
}

export async function getGoogleSession(config: ChurchConfig): Promise<Session | null> {
  const resolution = await resolveGoogleSession(config);
  if (resolution.status !== "signed-in") return null;
  const { id, role, name } = resolution.member;
  return { teamMemberId: id, role, name };
}
