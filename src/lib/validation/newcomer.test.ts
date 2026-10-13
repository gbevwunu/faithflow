import { describe, expect, it } from "vitest";
import {
  EMPTY_NEWCOMER_FORM,
  NAME_MAX,
  prefillFromSearch,
  validateNewcomerForm,
  type NewcomerFormInput,
} from "./newcomer";

const valid: NewcomerFormInput = {
  ...EMPTY_NEWCOMER_FORM,
  firstName: "Tobi",
  lastName: "Adegoke",
  phone: "(204) 555-0190",
  email: "tobi@example.com",
  heardViaSource: "social_media",
};

function errorsFor(overrides: Partial<NewcomerFormInput>) {
  const result = validateNewcomerForm({ ...valid, ...overrides });
  return result.ok ? {} : result.errors;
}

describe("validateNewcomerForm", () => {
  it("accepts the required fields and normalizes the phone", () => {
    expect(validateNewcomerForm(valid)).toEqual({
      ok: true,
      data: {
        firstName: "Tobi",
        lastName: "Adegoke",
        phone: "+12045550190",
        email: "tobi@example.com",
        heardVia: { source: "social_media" },
        consentToMessages: false,
      },
    });
  });

  it("trims but otherwise keeps input exactly as entered", () => {
    const result = validateNewcomerForm({
      ...valid,
      firstName: "  mary-jane ",
      lastName: " o'BRIEN ",
      occupation: "  Night nurse  ",
    });
    expect(result).toMatchObject({
      ok: true,
      data: { firstName: "mary-jane", lastName: "o'BRIEN", occupation: "Night nurse" },
    });
  });

  it.each([
    ["missing first name", { firstName: "" }, "firstName"],
    ["whitespace last name", { lastName: "   " }, "lastName"],
    ["first name too long", { firstName: "a".repeat(NAME_MAX + 1) }, "firstName"],
    ["missing phone", { phone: "" }, "phone"],
    ["short phone", { phone: "555-0190" }, "phone"],
    ["international phone", { phone: "+44 20 7946 0958" }, "phone"],
    ["missing email", { email: "" }, "email"],
    ["invalid email", { email: "tobi@" }, "email"],
    ["day without month", { birthdayDay: "14" }, "birthdayMonth"],
    ["month without day", { birthdayMonth: "9" }, "birthdayDay"],
    ["February 30", { birthdayMonth: "2", birthdayDay: "30" }, "birthdayDay"],
    ["April 31", { birthdayMonth: "4", birthdayDay: "31" }, "birthdayDay"],
    ["month 13", { birthdayMonth: "13", birthdayDay: "1" }, "birthdayMonth"],
    ["day 0", { birthdayMonth: "1", birthdayDay: "0" }, "birthdayDay"],
    ["non-numeric day", { birthdayMonth: "1", birthdayDay: "1st" }, "birthdayDay"],
    ["occupation too long", { occupation: "x".repeat(81) }, "occupation"],
    ["no heard-via choice", { heardViaSource: null }, "heardViaSource"],
  ] as const)("rejects %s", (_label, overrides, field) => {
    expect(errorsFor(overrides)).toHaveProperty(field);
  });

  it("accepts February 29 and stores month and day only", () => {
    expect(validateNewcomerForm({ ...valid, birthdayMonth: "2", birthdayDay: "29" })).toMatchObject(
      {
        ok: true,
        data: { birthday: { month: 2, day: 29 } },
      },
    );
  });

  it("stores how they heard about us with an optional follow-up", () => {
    expect(
      validateNewcomerForm({ ...valid, heardViaSource: "friend", heardViaDetail: " Tunde " }),
    ).toMatchObject({ ok: true, data: { heardVia: { source: "friend", detail: "Tunde" } } });
    const noDetail = validateNewcomerForm({
      ...valid,
      heardViaSource: "flier",
      heardViaDetail: "ignored: flier has no follow-up",
    });
    expect(noDetail).toMatchObject({ ok: true, data: { heardVia: { source: "flier" } } });
    expect(noDetail.ok && noDetail.data.heardVia).toEqual({ source: "flier" });
  });

  it("asks for the heard-via choice but not its follow-up", () => {
    const result = validateNewcomerForm({ ...valid, heardViaSource: null, heardViaDetail: "x" });
    expect(result).toEqual({
      ok: false,
      errors: { heardViaSource: "Choose how they heard about us" },
    });
    expect(validateNewcomerForm({ ...valid, heardViaDetail: "" }).ok).toBe(true);
  });

  it("rejects an unknown heard-via source and a non-boolean consent", () => {
    expect(validateNewcomerForm({ ...valid, heardViaSource: "radio" }).ok).toBe(false);
    expect(validateNewcomerForm({ ...valid, consentToMessages: "yes" }).ok).toBe(false);
  });

  it("stores consent exactly as given", () => {
    expect(validateNewcomerForm({ ...valid, consentToMessages: true })).toMatchObject({
      ok: true,
      data: { consentToMessages: true },
    });
  });
});

describe("prefillFromSearch", () => {
  it.each([
    ["Adebayo", { firstName: "Adebayo", lastName: "" }],
    ["  Adebayo   Ogunleye ", { firstName: "Adebayo", lastName: "Ogunleye" }],
    ["Mary Jane Nwosu", { firstName: "Mary Jane Nwosu", lastName: "" }],
    ["0148", { firstName: "", lastName: "" }],
    ["", { firstName: "", lastName: "" }],
  ])("prefills %j", (query, expected) => {
    expect(prefillFromSearch(query)).toEqual(expected);
  });
});
