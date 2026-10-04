import { describe, expect, it } from "vitest";
import { getChurchConfig } from "@/lib/config";
import { getMarkingWindow } from "./marking-window";

// NewBreed: Sunday service, team lock 17:00, corrections until 19:00, America/Winnipeg.
const config = getChurchConfig("newbreed");

/** Instants are written in UTC; comments give Winnipeg wall-clock time (CDT is UTC-5). */
const at = (iso: string) => new Date(iso);

const CDT_SUNDAY_LOCK = "2026-10-04T22:00:00.000Z"; // Sun Oct 4, 17:00 CDT
const CDT_SUNDAY_CORRECTIONS_END = "2026-10-05T00:00:00.000Z"; // Sun Oct 4, 19:00 CDT

describe("getMarkingWindow", () => {
  describe("team", () => {
    it("is open at 4:59 PM on Sunday, closing at 5:00 PM", () => {
      const window = getMarkingWindow(at("2026-10-04T21:59:00Z"), "team", config);
      expect(window).toEqual({ allowed: true, state: "open", closesAt: at(CDT_SUNDAY_LOCK) });
    });

    it("is open in the last second before the lock", () => {
      expect(getMarkingWindow(at("2026-10-04T21:59:59.999Z"), "team", config).allowed).toBe(true);
    });

    it("is not allowed at 5:00 PM on Sunday; corrections are in progress", () => {
      const window = getMarkingWindow(at("2026-10-04T22:00:00Z"), "team", config);
      expect(window).toEqual({ allowed: false, state: "corrections", closesAt: null });
    });

    it("is open from midnight on Sunday", () => {
      const window = getMarkingWindow(at("2026-10-04T05:00:00Z"), "team", config);
      expect(window.allowed).toBe(true);
      expect(window.state).toBe("open");
    });
  });

  describe("admin", () => {
    it("is open before the team lock, closing at the end of corrections", () => {
      const window = getMarkingWindow(at("2026-10-04T21:59:00Z"), "admin", config);
      expect(window).toEqual({
        allowed: true,
        state: "open",
        closesAt: at(CDT_SUNDAY_CORRECTIONS_END),
      });
    });

    it("is allowed in the corrections window at 5:00 PM", () => {
      const window = getMarkingWindow(at("2026-10-04T22:00:00Z"), "admin", config);
      expect(window).toEqual({
        allowed: true,
        state: "corrections",
        closesAt: at(CDT_SUNDAY_CORRECTIONS_END),
      });
    });

    it("is allowed at 6:59 PM", () => {
      const window = getMarkingWindow(at("2026-10-04T23:59:00Z"), "admin", config);
      expect(window).toEqual({
        allowed: true,
        state: "corrections",
        closesAt: at(CDT_SUNDAY_CORRECTIONS_END),
      });
    });

    it("is closed at 7:00 PM", () => {
      const window = getMarkingWindow(at("2026-10-05T00:00:00Z"), "admin", config);
      expect(window).toEqual({ allowed: false, state: "closed", closesAt: null });
    });
  });

  it("is closed for everyone after corrections end", () => {
    for (const role of ["team", "admin"] as const) {
      expect(getMarkingWindow(at("2026-10-05T03:00:00Z"), role, config)).toEqual({
        allowed: false,
        state: "closed",
        closesAt: null,
      });
    }
  });

  it("is closed for everyone on a Monday", () => {
    // Mon Oct 5, 10:00 CDT.
    for (const role of ["team", "admin"] as const) {
      expect(getMarkingWindow(at("2026-10-05T15:00:00Z"), role, config)).toEqual({
        allowed: false,
        state: "closed",
        closesAt: null,
      });
    }
  });

  it("is closed when it is Sunday in UTC but still Saturday in Winnipeg", () => {
    // Sun Oct 4, 03:00 UTC is Sat Oct 3, 22:00 CDT.
    for (const role of ["team", "admin"] as const) {
      expect(getMarkingWindow(at("2026-10-04T03:00:00Z"), role, config)).toEqual({
        allowed: false,
        state: "closed",
        closesAt: null,
      });
    }
  });

  it("treats Sunday evening in Winnipeg as Sunday even when it is Monday in UTC", () => {
    // Mon Oct 5, 00:30 UTC is Sun Oct 4, 19:30 CDT: closed because corrections have ended.
    expect(getMarkingWindow(at("2026-10-05T00:30:00Z"), "admin", config).state).toBe("closed");
    // Mon Oct 5, 04:59 UTC is Sun Oct 4, 23:59 CDT.
    expect(getMarkingWindow(at("2026-10-05T04:59:00Z"), "admin", config).state).toBe("closed");
  });

  describe("Sunday November 1, 2026, when daylight saving time ends (CST is UTC-6)", () => {
    it("is open for team at 4:59 PM CST, closing at 5:00 PM CST", () => {
      const window = getMarkingWindow(at("2026-11-01T22:59:00Z"), "team", config);
      expect(window).toEqual({
        allowed: true,
        state: "open",
        closesAt: at("2026-11-01T23:00:00.000Z"),
      });
    });

    it("is still open at 22:00 UTC, which would be 5:00 PM under the old offset", () => {
      expect(getMarkingWindow(at("2026-11-01T22:00:00Z"), "team", config).state).toBe("open");
    });

    it("locks team at 5:00 PM CST", () => {
      expect(getMarkingWindow(at("2026-11-01T23:00:00Z"), "team", config)).toEqual({
        allowed: false,
        state: "corrections",
        closesAt: null,
      });
    });

    it("lets admin correct until 7:00 PM CST", () => {
      expect(getMarkingWindow(at("2026-11-02T00:59:00Z"), "admin", config)).toEqual({
        allowed: true,
        state: "corrections",
        closesAt: at("2026-11-02T01:00:00.000Z"),
      });
      expect(getMarkingWindow(at("2026-11-02T01:00:00Z"), "admin", config).state).toBe("closed");
    });

    it("is open during the repeated 1 AM hour", () => {
      // 06:30 UTC is 01:30 CDT, 07:30 UTC is 01:30 CST.
      expect(getMarkingWindow(at("2026-11-01T06:30:00Z"), "team", config).state).toBe("open");
      expect(getMarkingWindow(at("2026-11-01T07:30:00Z"), "team", config).state).toBe("open");
    });
  });
});
