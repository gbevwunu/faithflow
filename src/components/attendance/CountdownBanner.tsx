import type { TeamRole } from "@/lib/config";
import { capitalize, formatDuration, formatTimeOfDay } from "@/lib/format";
import type { MarkingState } from "@/lib/rules";

export interface CountdownBannerProps {
  state: MarkingState;
  role: TeamRole;
  isServiceDay: boolean;
  serviceDay: string;
  teamLockTime: string;
  correctionEndTime: string;
  msToTeamLock: number;
  msToCorrectionEnd: number;
}

export function bannerContent({
  state,
  role,
  isServiceDay,
  serviceDay,
  teamLockTime,
  correctionEndTime,
  msToTeamLock,
  msToCorrectionEnd,
}: CountdownBannerProps): { tone: "warning" | "info"; text: string } {
  const lock = formatTimeOfDay(teamLockTime);
  const end = formatTimeOfDay(correctionEndTime);
  if (state === "open") {
    return {
      tone: "warning",
      text: `Ticking closes at ${lock} · ${formatDuration(msToTeamLock)} left`,
    };
  }
  if (state === "corrections") {
    return role === "admin"
      ? {
          tone: "warning",
          text: `Corrections close at ${end} · ${formatDuration(msToCorrectionEnd)} left`,
        }
      : { tone: "info", text: `Ticking closed. Ask an admin for corrections before ${end}.` };
  }
  return isServiceDay
    ? { tone: "info", text: `Attendance closed at ${end}.` }
    : { tone: "info", text: `Ticking opens on ${capitalize(serviceDay)}.` };
}

export function CountdownBanner(props: CountdownBannerProps) {
  const { tone, text } = bannerContent(props);
  return (
    <p
      className={`rounded-card px-3.5 py-3 text-[15px] leading-snug ${
        tone === "warning" ? "bg-warning-light text-warning" : "bg-primary-light text-primary"
      }`}
    >
      {text}
    </p>
  );
}
