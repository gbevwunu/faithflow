import "server-only";

import { InvalidChurchConfigError, UnknownChurchError } from "../errors";
import { churchConfigSchema, type ChurchConfig } from "../schema";
import { newbreed } from "./newbreed";

/** Raw church configs keyed by slug. Validated on access by getChurchConfig. */
const registry: Readonly<Record<string, unknown>> = {
  [newbreed.slug]: newbreed,
};

export function listChurchSlugs(): string[] {
  return Object.keys(registry);
}

/** Validates a raw church config, throwing InvalidChurchConfigError with every issue. */
export function parseChurchConfig(slug: string, raw: unknown): ChurchConfig {
  const result = churchConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidChurchConfigError(
      slug,
      result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }
  if (result.data.slug !== slug) {
    throw new InvalidChurchConfigError(slug, [
      `slug: config slug "${result.data.slug}" does not match registry key "${slug}"`,
    ]);
  }
  return result.data;
}

export function getChurchConfig(slug: string): ChurchConfig {
  if (!Object.hasOwn(registry, slug)) {
    throw new UnknownChurchError(slug);
  }
  return parseChurchConfig(slug, registry[slug]);
}
