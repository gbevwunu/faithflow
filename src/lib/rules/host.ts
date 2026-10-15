/** Subdomains that never resolve to a church. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set(["www", "app", "admin", "api"]);

/**
 * A church slug is one DNS label: lowercase letters, digits and hyphens, 1 to 63 characters,
 * with no hyphen at the start or end. Shared with the church config schema.
 */
export const CHURCH_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const LOCAL_ROOT = "localhost";

/** Lowercases a hostname and drops one trailing dot; returns null if it is not a plain hostname. */
function normalizeHostname(value: string): string | null {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  return HOSTNAME_PATTERN.test(hostname) && !hostname.includes("..") ? hostname : null;
}

/** Splits "name:port", rejecting anything but an optional numeric port. */
function stripPort(host: string): string | null {
  const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(host.trim());
  return match?.[1] ?? null;
}

function subdomainOf(hostname: string, root: string): string | null {
  return hostname.endsWith(`.${root}`) ? hostname.slice(0, -(root.length + 1)) : null;
}

/**
 * The church slug selected by a request's Host header, or null.
 *
 * Resolves `<slug>.<rootDomain>` and, for local development, `<slug>.localhost`. The bare
 * root domain, reserved subdomains, nested subdomains, invalid slugs and every other host
 * return null, so a forged Host header cannot select a church through any other domain.
 */
export function churchSlugFromHost(
  host: string | null | undefined,
  rootDomain: string | null | undefined,
): string | null {
  if (!host) return null;
  const hostWithoutPort = stripPort(host);
  const hostname = hostWithoutPort === null ? null : normalizeHostname(hostWithoutPort);
  if (!hostname) return null;

  const root = rootDomain ? normalizeHostname(rootDomain) : null;
  const label =
    (root !== null && root !== LOCAL_ROOT ? subdomainOf(hostname, root) : null) ??
    subdomainOf(hostname, LOCAL_ROOT);

  if (label === null || !CHURCH_SLUG_PATTERN.test(label) || RESERVED_SUBDOMAINS.has(label)) {
    return null;
  }
  return label;
}
