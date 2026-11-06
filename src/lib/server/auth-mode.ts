import "server-only";

/**
 * Whether real Google sign-in is used: only on a production deployment. Previews and local
 * development use the fake session from the dev tools instead, and production never does.
 */
export function realSignInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}
