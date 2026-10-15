import { NextResponse, type NextRequest } from "next/server";
import { churchSlugFromHost } from "@/lib/rules/host";

/**
 * On a church subdomain (newbreed.<ROOT_DOMAIN>), rewrites /attendance to /newbreed/attendance
 * so the visible URL stays short. Every other host falls through to path-based routing
 * (/newbreed/attendance), which Vercel previews and localhost rely on. This never redirects:
 * an unknown church is rewritten like any other and its layout answers 404.
 */
export function proxy(request: NextRequest) {
  const slug = churchSlugFromHost(request.headers.get("host"), process.env.ROOT_DOMAIN);
  if (!slug) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip build assets and files with an extension (favicon, images). Page requests and server
  // action POSTs still pass through, so they are rewritten to the church's routes too.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
