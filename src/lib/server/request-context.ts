import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import type { ChurchConfig, TeamRole } from "@/lib/config";
import { teamRoleSchema } from "@/lib/config";
import { DEV_NOW_COOKIE, DEV_ROLE_COOKIE, devToolsEnabled } from "./dev-tools";

export interface Session {
  teamMemberId: string;
  role: TeamRole;
  name: string;
}

/**
 * The signed-in team member for this church, or null. Real sign-in does not exist yet;
 * in development the fake session picks the church's first team member with the role
 * chosen in the dev toolbar (team by default).
 */
export async function getSession(config: ChurchConfig): Promise<Session | null> {
  if (!devToolsEnabled()) return null;
  const cookieRole = teamRoleSchema.safeParse((await cookies()).get(DEV_ROLE_COOKIE)?.value);
  const role = cookieRole.success ? cookieRole.data : "team";
  const member = config.team.find((m) => m.role === role);
  return member ? { teamMemberId: member.id, role: member.role, name: member.name } : null;
}

const fakeNowSchema = z.iso.datetime({ offset: true });

/** The current instant, or the dev toolbar's fake time in development. */
export async function getNow(): Promise<Date> {
  if (devToolsEnabled()) {
    const fake = fakeNowSchema.safeParse((await cookies()).get(DEV_NOW_COOKIE)?.value);
    if (fake.success) return new Date(fake.data);
  }
  return new Date();
}

/** Whether the clock is currently faked; for display in the dev toolbar only. */
export async function isNowFaked(): Promise<boolean> {
  if (!devToolsEnabled()) return false;
  return fakeNowSchema.safeParse((await cookies()).get(DEV_NOW_COOKIE)?.value).success;
}
