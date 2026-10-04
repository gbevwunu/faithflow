import "server-only";

/** Environment variables that control the development-only fake session and clock. */
export interface DevToolsEnv {
  NODE_ENV?: string;
  DEV_FAKE_SESSION?: string;
  VERCEL_ENV?: string;
}

export class DevToolsInProductionError extends Error {
  constructor() {
    super(
      "Development tools (fake session and fake clock) are enabled on a production deployment. Unset DEV_FAKE_SESSION.",
    );
    this.name = "DevToolsInProductionError";
  }
}

/**
 * Whether the fake session and fake clock may be used. They are only requested in local
 * development (NODE_ENV=development) or with an explicit DEV_FAKE_SESSION=true, and they
 * refuse to run on a production deployment: requesting them there throws instead of
 * silently granting access.
 */
export function devToolsEnabled(env: DevToolsEnv = process.env): boolean {
  const requested = env.NODE_ENV === "development" || env.DEV_FAKE_SESSION === "true";
  if (!requested) return false;
  if (env.VERCEL_ENV === "production") throw new DevToolsInProductionError();
  return true;
}

export const DEV_ROLE_COOKIE = "ff-dev-role";
export const DEV_NOW_COOKIE = "ff-dev-now";
