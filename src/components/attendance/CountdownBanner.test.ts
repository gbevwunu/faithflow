import { describe, expect, it } from "vitest";
import { bannerContent, type CountdownBannerProps } from "./CountdownBanner";

const base: CountdownBannerProps = {
  state: "open",
  role: "team",
  isServiceDay: true,
  serviceDay: "sunday",
  teamLockTime: "17:00",
  correctionEndTime: "19:00",
  msToTeamLock: (2 * 60 + 14) * 60_000,
  msToCorrectionEnd: (4 * 60 + 14) * 60_000,
};

describe("bannerContent", () => {
  it("shows the team lock countdown while open, for every role", () => {
    for (const role of ["team", "admin"] as const) {
      expect(bannerContent({ ...base, role })).toEqual({
        tone: "warning",
        text: "Ticking closes at 5:00 PM · 2h 14m left",
      });
    }
  });

  it("shows admins the corrections countdown", () => {
    expect(
      bannerContent({
        ...base,
        state: "corrections",
        role: "admin",
        msToCorrectionEnd: 25 * 60_000,
      }),
    ).toEqual({ tone: "warning", text: "Corrections close at 7:00 PM · 25m left" });
  });

  it("tells team to ask an admin during corrections", () => {
    expect(bannerContent({ ...base, state: "corrections" })).toEqual({
      tone: "info",
      text: "Ticking closed. Ask an admin for corrections before 7:00 PM.",
    });
  });

  it("explains when attendance is closed", () => {
    expect(bannerContent({ ...base, state: "closed" }).text).toBe("Attendance closed at 7:00 PM.");
    expect(bannerContent({ ...base, state: "closed", isServiceDay: false }).text).toBe(
      "Ticking opens on Sunday.",
    );
  });
});
