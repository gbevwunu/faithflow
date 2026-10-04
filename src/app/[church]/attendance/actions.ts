"use server";

import "server-only";
import { z } from "zod";
import { UnknownChurchError, getChurchConfig } from "@/lib/config";
import { getMarkingWindow, getServiceDate } from "@/lib/rules";
import { toClientMark, type ClientMark } from "@/lib/server/client-roster";
import { getDataSource } from "@/lib/server/data-source";
import { getNow, getSession } from "@/lib/server/request-context";

export type AttendanceActionResult =
  | { ok: true; mark: ClientMark | null }
  | {
      ok: false;
      code:
        | "invalid-input"
        | "unknown-church"
        | "not-signed-in"
        | "window-closed"
        | "not-on-roster"
        | "server-error";
      error: string;
    };

// Unknown keys (such as a markedBy sent by the browser) are stripped, never used.
const attendanceInputSchema = z.object({
  church: z.string().min(1).max(64),
  personId: z.string().min(1).max(128),
});

function refuse(
  code: Extract<AttendanceActionResult, { ok: false }>["code"],
  error: string,
): AttendanceActionResult {
  return { ok: false, code, error };
}

async function changeAttendance(
  kind: "mark" | "unmark",
  input: unknown,
): Promise<AttendanceActionResult> {
  const parsed = attendanceInputSchema.safeParse(input);
  if (!parsed.success) return refuse("invalid-input", "That request was not valid.");
  const { church, personId } = parsed.data;

  let config;
  try {
    config = getChurchConfig(church);
  } catch (error) {
    if (error instanceof UnknownChurchError) return refuse("unknown-church", "Unknown church.");
    throw error;
  }

  // The acting team member always comes from the session, never from the request.
  const session = await getSession(config);
  if (!session) return refuse("not-signed-in", "Please sign in to mark attendance.");

  const now = await getNow();
  const window = getMarkingWindow(now, session.role, config);
  if (!window.allowed) {
    return refuse(
      "window-closed",
      window.state === "corrections"
        ? "Ticking has closed. Ask an admin for corrections."
        : "Attendance is closed.",
    );
  }

  const serviceDate = getServiceDate(now, config);
  const isCorrection = window.state === "corrections";
  const dataSource = getDataSource(config);

  try {
    const roster = await dataSource.getRoster(serviceDate);
    if (!roster.some((entry) => entry.person.id === personId)) {
      return refuse("not-on-roster", "This person is not on today's list.");
    }

    if (kind === "mark") {
      const mark = await dataSource.markPresent({
        personId,
        serviceDate,
        markedBy: session.teamMemberId,
        isCorrection,
        markedAt: now,
      });
      return { ok: true, mark: toClientMark(mark, config) };
    }

    await dataSource.unmark({ personId, serviceDate, by: session.teamMemberId, isCorrection });
    return { ok: true, mark: null };
  } catch (error) {
    // Ids only; never names, phones or emails.
    console.error("Attendance change failed", {
      action: kind,
      church: config.slug,
      personId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return refuse("server-error", "Something went wrong. Please try again.");
  }
}

export async function markPresentAction(input: unknown): Promise<AttendanceActionResult> {
  return changeAttendance("mark", input);
}

export async function unmarkAction(input: unknown): Promise<AttendanceActionResult> {
  return changeAttendance("unmark", input);
}
