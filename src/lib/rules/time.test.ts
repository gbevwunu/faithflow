import { describe, expect, it } from "vitest";
import { getServiceDate, zonedTimeToInstant } from "./time";

const winnipeg = { timezone: "America/Winnipeg" };

describe("getServiceDate", () => {
  it("returns the church's local date, not the UTC date", () => {
    // 03:00 UTC Sunday is 22:00 CDT Saturday in Winnipeg.
    expect(getServiceDate(new Date("2026-10-04T03:00:00Z"), winnipeg)).toBe("2026-10-03");
    expect(getServiceDate(new Date("2026-10-04T05:00:00Z"), winnipeg)).toBe("2026-10-04");
  });

  it("uses the configured timezone", () => {
    const instant = new Date("2026-10-04T03:00:00Z");
    expect(getServiceDate(instant, { timezone: "Asia/Tokyo" })).toBe("2026-10-04");
    expect(getServiceDate(instant, { timezone: "UTC" })).toBe("2026-10-04");
  });

  it("handles the day daylight saving time ends", () => {
    // Sunday November 1 runs from 00:00 CDT (05:00 UTC) to 24:00 CST (06:00 UTC next day).
    expect(getServiceDate(new Date("2026-11-01T05:00:00Z"), winnipeg)).toBe("2026-11-01");
    expect(getServiceDate(new Date("2026-11-02T05:59:59Z"), winnipeg)).toBe("2026-11-01");
    expect(getServiceDate(new Date("2026-11-02T06:00:00Z"), winnipeg)).toBe("2026-11-02");
  });
});

describe("zonedTimeToInstant", () => {
  it("converts local wall-clock time to the right instant across daylight saving", () => {
    expect(zonedTimeToInstant("2026-10-04", "17:00", "America/Winnipeg").toISOString()).toBe(
      "2026-10-04T22:00:00.000Z",
    );
    expect(zonedTimeToInstant("2026-11-01", "17:00", "America/Winnipeg").toISOString()).toBe(
      "2026-11-01T23:00:00.000Z",
    );
    expect(zonedTimeToInstant("2026-03-08", "17:00", "America/Winnipeg").toISOString()).toBe(
      "2026-03-08T22:00:00.000Z",
    );
  });

  it("resolves a time repeated by fall-back to its first occurrence", () => {
    // 01:30 happens at 06:30 UTC (CDT) and again at 07:30 UTC (CST).
    expect(zonedTimeToInstant("2026-11-01", "01:30", "America/Winnipeg").toISOString()).toBe(
      "2026-11-01T06:30:00.000Z",
    );
  });

  it("moves a time skipped by spring-forward to just after the gap", () => {
    // Clocks jump from 02:00 CST to 03:00 CDT; 02:30 becomes 03:30 CDT.
    expect(zonedTimeToInstant("2026-03-08", "02:30", "America/Winnipeg").toISOString()).toBe(
      "2026-03-08T08:30:00.000Z",
    );
  });
});
