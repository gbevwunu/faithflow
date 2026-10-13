"use server";

import "server-only";
import { z } from "zod";
import { toClientMark, type ClientMark } from "@/lib/server/client-roster";
import { getMarkingContext, logFailure, refuse, type Refusal } from "@/lib/server/marking-context";

export type AttendanceActionResult = { ok: true; mark: ClientMark | null } | Refusal;

// Unknown keys (such as a markedBy sent by the browser) are stripped, never used.
const attendanceInputSchema = z.object({
  church: z.string().min(1).max(64),
  personId: z.string().min(1).max(128),
});

async function changeAttendance(
  kind: "mark" | "unmark",
  input: unknown,
): Promise<AttendanceActionResult> {
  const parsed = attendanceInputSchema.safeParse(input);
  if (!parsed.success) return refuse("invalid-input", "That request was not valid.");
  const { church, personId } = parsed.data;

  // The acting team member always comes from the session, never from the request.
  const context = await getMarkingContext(church);
  if (!context.ok) return context;
  const { config, session, dataSource, now, serviceDate, isCorrection } = context;

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
    logFailure(`attendance.${kind}`, config.slug, error, personId);
    return refuse("server-error", "Something went wrong. Please try again.");
  }
}

export async function markPresentAction(input: unknown): Promise<AttendanceActionResult> {
  return changeAttendance("mark", input);
}

export async function unmarkAction(input: unknown): Promise<AttendanceActionResult> {
  return changeAttendance("unmark", input);
}
