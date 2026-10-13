import "server-only";

import { UnknownChurchError, getChurchConfig, type ChurchConfig } from "@/lib/config";
import type { DataSource, IsoDate } from "@/lib/data";
import { getMarkingWindow, getServiceDate } from "@/lib/rules";
import { getDataSource } from "./data-source";
import { getNow, getSession, type Session } from "./request-context";

export type RefusalCode =
  | "invalid-input"
  | "unknown-church"
  | "not-signed-in"
  | "window-closed"
  | "not-on-roster"
  | "server-error";

export interface Refusal {
  ok: false;
  code: RefusalCode;
  error: string;
}

export function refuse(code: RefusalCode, error: string): Refusal {
  return { ok: false, code, error };
}

export interface SignedInContext {
  ok: true;
  config: ChurchConfig;
  session: Session;
  dataSource: DataSource;
}

export interface MarkingContext extends SignedInContext {
  now: Date;
  serviceDate: IsoDate;
  isCorrection: boolean;
}

/** The church and the signed-in team member, both from the server, never the request. */
export async function getSignedInContext(church: string): Promise<SignedInContext | Refusal> {
  let config: ChurchConfig;
  try {
    config = getChurchConfig(church);
  } catch (error) {
    if (error instanceof UnknownChurchError) return refuse("unknown-church", "Unknown church.");
    throw error;
  }

  const session = await getSession(config);
  if (!session) return refuse("not-signed-in", "Please sign in to continue.");
  return { ok: true, config, session, dataSource: getDataSource(config) };
}

/** As getSignedInContext, and refuses unless the member's role may mark attendance right now. */
export async function getMarkingContext(church: string): Promise<MarkingContext | Refusal> {
  const context = await getSignedInContext(church);
  if (!context.ok) return context;

  const now = await getNow();
  const window = getMarkingWindow(now, context.session.role, context.config);
  if (!window.allowed) {
    return refuse(
      "window-closed",
      window.state === "corrections"
        ? "Ticking has closed. Ask an admin for corrections."
        : "Attendance is closed.",
    );
  }

  return {
    ...context,
    now,
    serviceDate: getServiceDate(now, context.config),
    isCorrection: window.state === "corrections",
  };
}

/** Logs a failure with ids only; never names, phones or emails. */
export function logFailure(action: string, church: string, error: unknown, personId?: string) {
  console.error("Action failed", {
    action,
    church,
    ...(personId ? { personId } : {}),
    error: error instanceof Error ? error.name : "UnknownError",
  });
}
