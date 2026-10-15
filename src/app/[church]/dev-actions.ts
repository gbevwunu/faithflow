"use server";

import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { getChurchConfig, teamRoleSchema } from "@/lib/config";
import { getLatestServiceDate, zonedTimeToInstant } from "@/lib/rules";
import { DataSourceConfigError, getSheetsClient } from "@/lib/server/data-source";
import { GoogleAuthConfigError } from "@/lib/server/google-auth";
import { MissingHeaderError } from "@/lib/server/sheets/layout";
import { SeedRefusedError, seedStagingSheet } from "@/lib/server/sheets/seed-staging";
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

/**
 * Development only: fills an empty staging spreadsheet with fake people. The seed itself
 * refuses unless the spreadsheet title contains "STAGING" and it has no data rows.
 */
export async function seedStagingSheetAction(
  church: unknown,
): Promise<{ ok: boolean; message: string }> {
  if (!devToolsEnabled()) return { ok: false, message: "Development tools are not enabled." };
  const parsed = z.string().min(1).max(64).safeParse(church);
  if (!parsed.success) return { ok: false, message: "Unknown church." };

  let config;
  try {
    config = getChurchConfig(parsed.data);
  } catch {
    return { ok: false, message: "Unknown church." };
  }
  if (config.dataSource.type !== "google-sheets") {
    return { ok: false, message: "This church does not use Google Sheets." };
  }

  try {
    const { client } = getSheetsClient(config.dataSource);
    const result = await seedStagingSheet({
      client,
      layout: config.dataSource,
      firstVisitDate: getLatestServiceDate(new Date(), config),
    });
    return {
      ok: true,
      message: `Seeded ${result.members} members and ${result.newcomers} newcomers.`,
    };
  } catch (error) {
    if (
      error instanceof SeedRefusedError ||
      error instanceof MissingHeaderError ||
      error instanceof DataSourceConfigError ||
      error instanceof GoogleAuthConfigError
    ) {
      return { ok: false, message: error.message };
    }
    console.error("Seeding the staging sheet failed", {
      church: config.slug,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "Seeding failed. Check the server logs." };
  }
}
