import type { PhoneE164 } from "@/lib/data";

const ALLOWED_CHARACTERS = /^\+?[\d\s().-]+$/;
// NANP: area code and exchange start with 2-9; area codes ending in 11 are service codes.
const NANP_NUMBER = /^([2-9](?!11)\d{2})([2-9]\d{2})(\d{4})$/;

/**
 * Normalizes a North American phone number to E.164, e.g. "(204) 555-0148" -> "+12045550148".
 * Returns null for anything that is not a valid 10-digit North American number.
 */
export function normalizePhone(input: string): PhoneE164 | null {
  const trimmed = input.trim();
  if (!ALLOWED_CHARACTERS.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length !== 11 || !digits.startsWith("1")) return null;
    digits = digits.slice(1);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return NANP_NUMBER.test(digits) ? `+1${digits}` : null;
}
