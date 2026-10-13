"use server";

import "server-only";
import { z } from "zod";
import { DuplicatePhoneError } from "@/lib/data";
import { normalizePhone } from "@/lib/rules";
import { getMarkingContext, logFailure, refuse, type Refusal } from "@/lib/server/marking-context";
import { toPhoneMatch, type PhoneMatch } from "@/lib/server/phone-match";
import { validateNewcomerForm, type NewcomerFieldErrors } from "@/lib/validation/newcomer";

const churchSchema = z.string().min(1).max(64);
const phoneLookupSchema = z.object({ church: churchSchema, phone: z.string().max(40) });
const addNewcomerSchema = z.object({ church: churchSchema, values: z.unknown() });

export type CheckPhoneResult =
  | { ok: true; status: "invalid" | "available" }
  | { ok: true; status: "match"; match: PhoneMatch }
  | Refusal;

/**
 * Looks up a phone as it is entered. Reveals only first name, last initial and list, and only
 * while the member's role may mark attendance, the same as saving.
 */
export async function checkPhoneAction(input: unknown): Promise<CheckPhoneResult> {
  const parsed = phoneLookupSchema.safeParse(input);
  if (!parsed.success) return refuse("invalid-input", "That request was not valid.");

  const context = await getMarkingContext(parsed.data.church);
  if (!context.ok) return context;

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: true, status: "invalid" };

  try {
    const person = await context.dataSource.findByPhone(phone);
    return person
      ? { ok: true, status: "match", match: toPhoneMatch(person) }
      : { ok: true, status: "available" };
  } catch (error) {
    logFailure("newcomer.checkPhone", context.config.slug, error);
    return refuse("server-error", "Could not check that number. Please try again.");
  }
}

export type TickExistingResult = { ok: true; match: PhoneMatch } | Refusal;

/** "Tick them instead": marks the existing person with this phone present, found on the server. */
export async function tickExistingAction(input: unknown): Promise<TickExistingResult> {
  const parsed = phoneLookupSchema.safeParse(input);
  if (!parsed.success) return refuse("invalid-input", "That request was not valid.");

  const context = await getMarkingContext(parsed.data.church);
  if (!context.ok) return context;
  const { config, session, dataSource, now, serviceDate, isCorrection } = context;

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return refuse("invalid-input", "Enter a 10-digit phone number.");

  try {
    const person = await dataSource.findByPhone(phone);
    const roster = await dataSource.getRoster(serviceDate);
    if (!person || !roster.some((entry) => entry.person.id === person.id)) {
      return refuse("not-on-roster", "No one with that number is on today's list.");
    }
    await dataSource.markPresent({
      personId: person.id,
      serviceDate,
      markedBy: session.teamMemberId,
      isCorrection,
      markedAt: now,
    });
    return { ok: true, match: toPhoneMatch(person) };
  } catch (error) {
    logFailure("newcomer.tickExisting", config.slug, error);
    return refuse("server-error", "Something went wrong. Please try again.");
  }
}

export type AddNewcomerResult =
  | { ok: true; marked: boolean }
  | { ok: false; code: "invalid-fields"; error: string; fieldErrors: NewcomerFieldErrors }
  | { ok: false; code: "duplicate"; error: string; match: PhoneMatch }
  | Refusal;

/** Adds a newcomer and marks them present, under the same window and roles as ticking. */
export async function addNewcomerAction(input: unknown): Promise<AddNewcomerResult> {
  const parsed = addNewcomerSchema.safeParse(input);
  if (!parsed.success) return refuse("invalid-input", "That request was not valid.");

  const context = await getMarkingContext(parsed.data.church);
  if (!context.ok) return context;
  const { config, session, dataSource, now, serviceDate, isCorrection } = context;

  const validation = validateNewcomerForm(parsed.data.values);
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid-fields",
      error: "Check the highlighted fields.",
      fieldErrors: validation.errors,
    };
  }
  const values = validation.data;

  let personId: string;
  try {
    const newcomer = await dataSource.addNewcomer({
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
      ...(values.birthday ? { birthday: values.birthday } : {}),
      ...(values.occupation ? { occupation: values.occupation } : {}),
      heardVia: values.heardVia,
      firstVisitDate: serviceDate,
      consentToMessages: values.consentToMessages,
      optedOut: false,
    });
    personId = newcomer.id;
  } catch (error) {
    if (error instanceof DuplicatePhoneError) {
      const match = toPhoneMatch(error.existing);
      return {
        ok: false,
        code: "duplicate",
        error: `This number matches ${match.firstName} ${match.lastInitial}. on the ${match.list} list.`,
        match,
      };
    }
    logFailure("newcomer.add", config.slug, error);
    return refuse("server-error", "Something went wrong. Please try again.");
  }

  try {
    await dataSource.markPresent({
      personId,
      serviceDate,
      markedBy: session.teamMemberId,
      isCorrection,
      markedAt: now,
    });
    return { ok: true, marked: true };
  } catch (error) {
    logFailure("newcomer.markPresent", config.slug, error, personId);
    return { ok: true, marked: false };
  }
}
