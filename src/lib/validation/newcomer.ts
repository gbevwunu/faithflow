import { z } from "zod";
import type { Birthday, HeardVia, HeardViaSource, PhoneE164 } from "@/lib/data";
import { normalizePhone } from "@/lib/rules";

export const NAME_MAX = 50;
export const EMAIL_MAX = 254;
export const OCCUPATION_MAX = 80;
export const HEARD_VIA_DETAIL_MAX = 100;

export const HEARD_VIA_OPTIONS: readonly {
  source: HeardViaSource;
  label: string;
  detailLabel: string | null;
}[] = [
  { source: "friend", label: "Friend", detailLabel: "Friend's name" },
  { source: "social_media", label: "Social media", detailLabel: "Which platform?" },
  { source: "flier", label: "Flier", detailLabel: null },
  { source: "other", label: "Other", detailLabel: "Please specify" },
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Whether a "How did you hear about us?" choice has a follow-up question. */
export function hasFollowUp(source: HeardViaSource): boolean {
  return HEARD_VIA_OPTIONS.some(
    (option) => option.source === source && option.detailLabel !== null,
  );
}

// February allows the 29th: birthdays have no year.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** The form exactly as the browser holds it: strings, a chosen chip and a checkbox. */
export interface NewcomerFormInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthdayMonth: string;
  birthdayDay: string;
  occupation: string;
  heardViaSource: HeardViaSource | null;
  heardViaDetail: string;
  consentToMessages: boolean;
}

export type NewcomerField = keyof NewcomerFormInput;

/** Validated values, trimmed but otherwise stored exactly as entered. */
export interface NewcomerFormData {
  firstName: string;
  lastName: string;
  phone: PhoneE164;
  email: string;
  birthday?: Birthday;
  occupation?: string;
  heardVia: HeardVia;
  consentToMessages: boolean;
}

export const EMPTY_NEWCOMER_FORM: NewcomerFormInput = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthdayMonth: "",
  birthdayDay: "",
  occupation: "",
  heardViaSource: null,
  heardViaDetail: "",
  consentToMessages: false,
};

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter their ${label}`)
    .max(NAME_MAX, `Keep the ${label} to ${NAME_MAX} characters or fewer`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${label} to ${max} characters or fewer`)
    .transform((value) => (value === "" ? undefined : value));

const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({
      code: "custom",
      message: value.trim() === "" ? "Enter their phone number" : "Enter a 10-digit phone number",
    });
    return z.NEVER;
  }
  return normalized;
});

export const newcomerFormSchema = z
  .object({
    firstName: requiredName("first name"),
    lastName: requiredName("last name"),
    phone: phoneSchema,
    email: z
      .string()
      .trim()
      .min(1, "Enter their email address")
      .max(EMAIL_MAX, "That email address is too long")
      .pipe(z.email("Enter a valid email address")),
    birthdayMonth: z.string().trim(),
    birthdayDay: z.string().trim(),
    occupation: optionalText(OCCUPATION_MAX, "occupation"),
    heardViaSource: z
      .enum(["friend", "social_media", "flier", "other"], {
        error: "Choose how they heard about us",
      })
      .nullable()
      .refine((source) => source !== null, "Choose how they heard about us"),
    heardViaDetail: optionalText(HEARD_VIA_DETAIL_MAX, "answer"),
    consentToMessages: z.boolean(),
  })
  .transform((values, ctx): NewcomerFormData => {
    let birthday: Birthday | undefined;
    const { birthdayMonth, birthdayDay } = values;
    if (birthdayMonth !== "" || birthdayDay !== "") {
      const month = /^\d{1,2}$/.test(birthdayMonth) ? Number(birthdayMonth) : NaN;
      const day = /^\d{1,2}$/.test(birthdayDay) ? Number(birthdayDay) : NaN;
      if (!(month >= 1 && month <= 12)) {
        ctx.addIssue({ code: "custom", path: ["birthdayMonth"], message: "Choose a month" });
      } else if (!(day >= 1 && day <= (DAYS_IN_MONTH[month - 1] ?? 0))) {
        ctx.addIssue({
          code: "custom",
          path: ["birthdayDay"],
          message: `Enter a day from 1 to ${DAYS_IN_MONTH[month - 1]}`,
        });
      } else {
        birthday = { month, day };
      }
    }

    return {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
      ...(birthday ? { birthday } : {}),
      ...(values.occupation ? { occupation: values.occupation } : {}),
      heardVia: {
        source: values.heardViaSource as HeardViaSource,
        ...(values.heardViaDetail && hasFollowUp(values.heardViaSource as HeardViaSource)
          ? { detail: values.heardViaDetail }
          : {}),
      },
      consentToMessages: values.consentToMessages,
    };
  });

export type NewcomerFieldErrors = Partial<Record<NewcomerField, string>>;

export type NewcomerValidation =
  { ok: true; data: NewcomerFormData } | { ok: false; errors: NewcomerFieldErrors };

/** Validates the whole form, returning the first message for each field. */
export function validateNewcomerForm(input: unknown): NewcomerValidation {
  const result = newcomerFormSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: NewcomerFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in EMPTY_NEWCOMER_FORM && !(field in errors)) {
      errors[field as NewcomerField] = issue.message;
    }
  }
  return { ok: false, errors };
}

/**
 * Prefill from attendance search text: one word becomes the first name; exactly two words
 * become first and last name. Anything else (including phone digits) prefills nothing extra.
 */
export function prefillFromSearch(
  query: string,
): Pick<NewcomerFormInput, "firstName" | "lastName"> {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || /^\d+$/.test(words.join(""))) return { firstName: "", lastName: "" };
  if (words.length === 2) return { firstName: words[0] ?? "", lastName: words[1] ?? "" };
  return { firstName: words.join(" "), lastName: "" };
}
