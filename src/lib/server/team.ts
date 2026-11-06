import "server-only";

import {
  InvalidTeamListError,
  parseTeamList,
  type ChurchConfig,
  type TeamList,
} from "@/lib/config";
import { realSignInEnabled } from "./auth-mode";
import { DEV_TEAM } from "./dev-team";
import { devToolsEnabled } from "./dev-tools";

type TeamEnv = Record<string, string | undefined>;

// Parsed lists keyed by env var name, re-parsed only when the value changes.
const cache = new Map<string, { raw: string | undefined; team: TeamList }>();

/**
 * The church's current team list. On production it is parsed from the church's team
 * environment variable; a missing or invalid list means nobody is on the team, so nobody can
 * sign in. With the dev tools on it is the fake development team. Otherwise it is empty.
 */
export function getTeam(config: ChurchConfig, env: TeamEnv = process.env): TeamList {
  if (realSignInEnabled(env)) return productionTeam(config, env);
  if (devToolsEnabled(env)) return DEV_TEAM;
  return [];
}

function productionTeam(config: ChurchConfig, env: TeamEnv): TeamList {
  const raw = env[config.teamEnv];
  const cached = cache.get(config.teamEnv);
  if (cached && cached.raw === raw) return cached.team;

  let team: TeamList = [];
  try {
    team = parseTeamList(raw, config.teamEnv);
  } catch (error) {
    if (!(error instanceof InvalidTeamListError)) throw error;
    // The message names the variable and the problem only, never its contents.
    console.error("Team list unavailable", { church: config.slug, error: error.message });
  }
  cache.set(config.teamEnv, { raw, team });
  return team;
}
