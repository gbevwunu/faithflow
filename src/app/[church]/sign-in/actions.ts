"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UnknownChurchError, getChurchConfig, type ChurchConfig } from "@/lib/config";
import { SIGN_IN_RATE_LIMITED_ERROR, churchSlugFromHost } from "@/lib/rules";
import { realSignInEnabled } from "@/lib/server/auth-mode";
import { getChurchBasePath } from "@/lib/server/church-paths";
import { RATE_LIMIT_RULES, isRateLimited } from "@/lib/server/rate-limit";

const churchSchema = z.string().min(1).max(64);

function churchConfig(church: unknown): ChurchConfig | null {
  const parsed = churchSchema.safeParse(church);
  if (!parsed.success) return null;
  try {
    return getChurchConfig(parsed.data);
  } catch (error) {
    if (error instanceof UnknownChurchError) return null;
    throw error;
  }
}

/**
 * Starts Google sign-in. Production only, and only on the church's own subdomain, where its
 * Google redirect address is registered. Every path here is built from the validated config.
 */
export async function signInWithGoogleAction(church: unknown): Promise<void> {
  const config = churchConfig(church);
  if (!config || !realSignInEnabled()) return;

  const requestHeaders = await headers();
  const hostChurch = churchSlugFromHost(requestHeaders.get("host"), process.env.ROOT_DOMAIN);
  if (hostChurch !== config.slug) redirect(`/${config.slug}/sign-in`);

  if (await isRateLimited(RATE_LIMIT_RULES.signIn, { headers: requestHeaders })) {
    redirect(`/sign-in?error=${SIGN_IN_RATE_LIMITED_ERROR}`);
  }

  const { signIn } = await import("@/lib/server/auth");
  await signIn("google", { redirectTo: "/attendance" });
}

/** Signs out and returns to the church's sign-in page. */
export async function signOutAction(church: unknown): Promise<void> {
  const config = churchConfig(church);
  if (!config || !realSignInEnabled()) return;

  const basePath = await getChurchBasePath(config.slug);
  const { signOut } = await import("@/lib/server/auth");
  await signOut({ redirectTo: `${basePath}/sign-in` });
}
