import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    "(204) 555-0148",
    "204-555-0148",
    "2045550148",
    "1 204 555 0148",
    "+1 204 555 0148",
    "+12045550148",
    "1-204-555-0148",
    "204.555.0148",
    "  204 555 0148  ",
    "+1 (204) 555-0148",
  ])("normalizes %j to E.164", (input) => {
    expect(normalizePhone(input)).toBe("+12045550148");
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["too short", "555-0148"],
    ["nine digits", "204555014"],
    ["eleven digits not starting with 1", "22045550148"],
    ["twelve digits", "120455501489"],
    ["international", "+44 20 7946 0958"],
    ["plus without country code", "+2045550148"],
    ["letters", "204-555-ABCD"],
    ["extension", "204-555-0148 ext 12"],
    ["text around number", "call 2045550148"],
    ["area code starting with 0", "004-555-0148"],
    ["area code starting with 1", "104-555-0148"],
    ["exchange starting with 0", "204-055-0148"],
    ["exchange starting with 1", "204-155-0148"],
    ["N11 area code", "911-555-0148"],
    ["plus in the middle", "204+5550148"],
  ])("returns null for %s", (_label, input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
