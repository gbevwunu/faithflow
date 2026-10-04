import { describe, expect, it } from "vitest";
import {
  capitalize,
  formatClockTime,
  formatDuration,
  formatServiceDate,
  formatTimeOfDay,
  initials,
} from "./format";

describe("formatTimeOfDay", () => {
  it.each([
    ["17:00", "5:00 PM"],
    ["19:00", "7:00 PM"],
    ["00:05", "12:05 AM"],
    ["12:30", "12:30 PM"],
    ["09:15", "9:15 AM"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatTimeOfDay(input)).toBe(expected);
  });
});

describe("formatClockTime", () => {
  it("formats in the given timezone, not the machine's", () => {
    expect(formatClockTime("2026-10-04T15:42:00Z", "America/Winnipeg")).toBe("10:42 AM");
    expect(formatClockTime("2026-11-01T23:00:00Z", "America/Winnipeg")).toBe("5:00 PM");
  });
});

describe("formatServiceDate", () => {
  it("formats a calendar date without shifting it", () => {
    expect(formatServiceDate("2026-09-27")).toBe("Sun, Sep 27");
    expect(formatServiceDate("2026-11-01")).toBe("Sun, Nov 1");
  });
});

describe("formatDuration", () => {
  it.each([
    [(2 * 60 + 14) * 60_000 + 59_000, "2h 14m"],
    [60 * 60_000, "1h 0m"],
    [14 * 60_000, "14m"],
    [59_000, "less than a minute"],
    [-5_000, "less than a minute"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("capitalize and initials", () => {
  it("works on simple names", () => {
    expect(capitalize("sunday")).toBe("Sunday");
    expect(initials("Adaeze", "Okafor")).toBe("AO");
    expect(initials(" mary jane ", "nwosu")).toBe("MN");
  });
});
