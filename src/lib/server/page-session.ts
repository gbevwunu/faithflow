import "server-only";

import { redirect } from "next/navigation";
import type { ChurchConfig } from "@/lib/config";
import { realSignInEnabled } from "./auth-mode";
import { getSession, type Session } from "./request-context";

/**
 * The session for a church page. On production a visitor without a valid session for this
 * church is sent to its sign-in page; elsewhere the page shows its own signed-out state.
 * The redirect target is built from the validated config slug, never from the request.
 */
export async function getPageSession(
  config: ChurchConfig,
  basePath: string,
): Promise<Session | null> {
  const session = await getSession(config);
  if (!session && realSignInEnabled()) redirect(`${basePath}/sign-in`);
  return session;
}
