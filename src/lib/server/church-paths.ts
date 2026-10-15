import "server-only";

import { headers } from "next/headers";
import { churchSlugFromHost } from "@/lib/rules/host";

/**
 * The URL prefix for a church's pages in this request: "" on the church's own subdomain
 * (newbreed.<ROOT_DOMAIN>/attendance), otherwise "/<slug>" for path-based URLs. The slug comes
 * from the validated church config, never from the request.
 */
export async function getChurchBasePath(slug: string): Promise<string> {
  const host = (await headers()).get("host");
  return churchSlugFromHost(host, process.env.ROOT_DOMAIN) === slug ? "" : `/${slug}`;
}
