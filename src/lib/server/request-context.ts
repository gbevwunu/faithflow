import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import type { ChurchConfig, TeamRole } from "@/lib/config";
import { teamRoleSchema } from "@/lib/config";
import { realSignInEnabled } from "./auth-mode";
import { DEV_TEAM } from "./dev-team";
import { DEV_NOW_COOKIE, DEV_ROLE_COOKIE, devToolsEnabled } from "./dev-tools";

export interface Session {
  teamMemberId: string;
  role: TeamRole;
  name: string;
}

/**
 * The signed-in team member for this church, or null. Checked on every request.
 *
 * On production this is the Google sign-in, resolved against the church's team list as it is
 * now; the dev cookies are never read there. Elsewhere, with the dev tools on, the fake session
 * picks the fake team member with the role chosen in the dev toolbar (team by default).
 */
export async function getSession(config: ChurchConfig): Promise<Session | null> {
  if (realSignInEnabled()) {
    // The fake session requested on production is a misconfiguration: this throws, loudly,
    // instead of ever falling back to it.
    devToolsEnabled();
    // Loaded only on production, so previews and tests never load the sign-in library.
    const { getGoogleSession } = await import("./auth-session");
    return getGoogleSession(config);
  }
  if (!devToolsEnabled()) return null;
  const cookieRole = teamRoleSchema.safeParse((await cookies()).get(DEV_ROLE_COOKIE)?.value);
  const role = cookieRole.success ? cookieRole.data : "team";
  const member = DEV_TEAM.find((m) => m.role === role);
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
