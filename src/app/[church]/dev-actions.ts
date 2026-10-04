"use server";

import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { getChurchConfig, teamRoleSchema } from "@/lib/config";
import { zonedTimeToInstant } from "@/lib/rules";
import { DEV_NOW_COOKIE, DEV_ROLE_COOKIE, devToolsEnabled } from "@/lib/server/dev-tools";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

const fakeNowSchema = z.object({
  church: z.string().min(1).max(64),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

/** Development only: switch the fake session between the team and admin roles. */
export async function setDevRoleAction(role: unknown): Promise<{ ok: boolean }> {
  if (!devToolsEnabled()) return { ok: false };
  const parsed = teamRoleSchema.safeParse(role);
  if (!parsed.success) return { ok: false };
  (await cookies()).set(DEV_ROLE_COOKIE, parsed.data, cookieOptions);
  return { ok: true };
}

/** Development only: fake the current time as a wall-clock time in the church's timezone. */
export async function setDevNowAction(input: unknown): Promise<{ ok: boolean }> {
  if (!devToolsEnabled()) return { ok: false };
  const parsed = fakeNowSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  let timezone: string;
  try {
    timezone = getChurchConfig(parsed.data.church).timezone;
  } catch {
    return { ok: false };
  }
  const instant = zonedTimeToInstant(parsed.data.date, parsed.data.time, timezone);
  (await cookies()).set(DEV_NOW_COOKIE, instant.toISOString(), cookieOptions);
  return { ok: true };
}

/** Development only: go back to the real clock. */
export async function clearDevNowAction(): Promise<{ ok: boolean }> {
  if (!devToolsEnabled()) return { ok: false };
  (await cookies()).delete(DEV_NOW_COOKIE);
  return { ok: true };
}
