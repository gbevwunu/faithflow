import type { NextRequest } from "next/server";
import { handleAuthRoute, signInRateLimited } from "@/lib/server/auth-route";

async function handle(request: NextRequest): Promise<Response> {
  return handleAuthRoute(request, {
    env: process.env,
    // Loaded only when a route is actually served, which is on production only.
    handle: async (req) => {
      const { handlers } = await import("@/lib/server/auth");
      return req.method === "POST" ? handlers.POST(req) : handlers.GET(req);
    },
    rateLimited: signInRateLimited,
  });
}

export const GET = handle;
export const POST = handle;
