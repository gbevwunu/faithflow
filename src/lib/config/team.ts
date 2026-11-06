import { teamListSchema, type TeamList, type TeamMember } from "./schema";

/** The team list environment variable is missing or invalid. Never includes its contents. */
export class InvalidTeamListError extends Error {
  constructor(envName: string, problems: string[]) {
    super(`${envName} is not a valid team list: ${problems.join("; ")}`);
    this.name = "InvalidTeamListError";
  }
}

/**
 * Parses a team list from its environment variable value: a JSON array of
 * { id, name, email, role } objects. Emails are lowercased. Problems name the position and
 * field only, never a value, so the error is safe to log.
 */
export function parseTeamList(raw: string | undefined, envName: string): TeamList {
  if (!raw?.trim()) throw new InvalidTeamListError(envName, ["it is not set"]);

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidTeamListError(envName, ["it is not valid JSON"]);
  }

  const result = teamListSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidTeamListError(
      envName,
      result.error.issues.map((issue) => `${issue.path.join(".") || "(list)"}: ${issue.message}`),
    );
  }
  return result.data;
}

export function findTeamMember(team: TeamList, id: string): TeamMember | undefined {
  return team.find((member) => member.id === id);
}

/** The team member with this email, compared in lowercase. */
export function findTeamMemberByEmail(team: TeamList, email: string): TeamMember | undefined {
  const normalized = email.trim().toLowerCase();
  return team.find((member) => member.email === normalized);
}

/** Display name for a team member id, or null if the id is not on the team. */
export function getTeamMemberName(team: TeamList, id: string): string | null {
  return findTeamMember(team, id)?.name ?? null;
}
