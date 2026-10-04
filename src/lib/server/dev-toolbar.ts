import "server-only";

import { cookies } from "next/headers";
import type { ChurchConfig, TeamRole } from "@/lib/config";
import { teamRoleSchema } from "@/lib/config";
import { capitalize, formatTimeOfDay } from "@/lib/format";
import { addDays, getLatestServiceDate } from "@/lib/rules";
import { DEV_ROLE_COOKIE } from "./dev-tools";
import { getNow, isNowFaked } from "./request-context";

export interface DevTimePreset {
  label: string;
  date: string;
  time: string;
}

export interface DevToolbarData {
  church: string;
  timezone: string;
  role: TeamRole;
  roles: { role: TeamRole; name: string }[];
  now: string;
  nowFaked: boolean;
  presets: DevTimePreset[];
}

function shiftTime(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Data for the development toolbar. Callers must check devToolsEnabled() first. */
export async function loadDevToolbar(config: ChurchConfig): Promise<DevToolbarData> {
  const parsedRole = teamRoleSchema.safeParse((await cookies()).get(DEV_ROLE_COOKIE)?.value);
  const realNow = new Date();
  const serviceDate = getLatestServiceDate(realNow, config);
  const { teamLockTime, correctionEndTime, serviceDay } = config.schedule;
  const day = capitalize(serviceDay).slice(0, 3);
  const at = (time: string, note: string, date = serviceDate): DevTimePreset => ({
    label: `${day} ${formatTimeOfDay(time)} · ${note}`,
    date,
    time,
  });

  return {
    church: config.slug,
    timezone: config.timezone,
    role: parsedRole.success ? parsedRole.data : "team",
    roles: (["team", "admin"] as const).flatMap((role) => {
      const member = config.team.find((m) => m.role === role);
      return member ? [{ role, name: member.name }] : [];
    }),
    now: (await getNow()).toISOString(),
    nowFaked: await isNowFaked(),
    presets: [
      at("10:30", "open"),
      at(shiftTime(teamLockTime, -1), "last minute"),
      at(teamLockTime, "team lock"),
      at(shiftTime(correctionEndTime, -1), "corrections"),
      at(correctionEndTime, "closed"),
      {
        label: `Next day ${formatTimeOfDay("10:00")} · closed`,
        date: addDays(serviceDate, 1),
        time: "10:00",
      },
    ],
  };
}
