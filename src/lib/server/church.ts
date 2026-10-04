import "server-only";

import { notFound } from "next/navigation";
import { UnknownChurchError, getChurchConfig, type ChurchConfig } from "@/lib/config";

/** Loads a church config for a route, responding 404 for an unknown slug. */
export function getChurchConfigOrNotFound(slug: string): ChurchConfig {
  try {
    return getChurchConfig(slug);
  } catch (error) {
    if (error instanceof UnknownChurchError) notFound();
    throw error;
  }
}
