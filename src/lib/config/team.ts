import type { ChurchConfig, TeamMember } from "./schema";

export function findTeamMember(config: ChurchConfig, id: string): TeamMember | undefined {
  return config.team.find((member) => member.id === id);
}

/** Display name for a team member id, or null if the id is not on the church's team. */
export function getTeamMemberName(config: ChurchConfig, id: string): string | null {
  return findTeamMember(config, id)?.name ?? null;
}
