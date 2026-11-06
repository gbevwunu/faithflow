import "server-only";

import NextAuth, { type NextAuthConfig, type Session as AuthSession } from "next-auth";
import Google from "next-auth/providers/google";
import { UnknownChurchError, getChurchConfig, type ChurchConfig } from "@/lib/config";
import {
  SESSION_MAX_AGE_SECONDS,
  churchSlugFromHost,
  decideSignIn,
  sessionClaimsSchema,
  type SessionClaims,
} from "@/lib/rules";
import { logSignInDecision } from "./sign-in-log";
import { getTeam } from "./team";

/** `__Host-`: Secure, path "/", and no Domain, so no other subdomain ever receives it. */
export const SESSION_COOKIE_NAME = "__Host-authjs.session-token";

/** The sign-in page, relative to the church's subdomain (the proxy adds the church). */
export const SIGN_IN_PATH = "/sign-in";

/** The church whose subdomain this Host header names, or null. */
export function churchForHost(host: string | null | undefined): ChurchConfig | null {
  const slug = churchSlugFromHost(host, process.env.ROOT_DOMAIN);
  if (!slug) return null;
  try {
    return getChurchConfig(slug);
  } catch (error) {
    if (error instanceof UnknownChurchError) return null;
    throw error;
  }
}

/**
 * Auth.js settings. `hostChurch` is the church named by the request's validated Host header;
 * it is only known on Auth.js's own routes, which is where sign-in completes.
 */
export function buildAuthConfig(hostChurch: ChurchConfig | null): NextAuthConfig {
  return {
    providers: [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        // Always offer the account chooser, so "Use a different account" works.
        authorization: { params: { prompt: "select_account" } },
      }),
    ],
    session: {
      strategy: "jwt",
      maxAge: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_MAX_AGE_SECONDS,
    },
    useSecureCookies: true,
    cookies: {
      sessionToken: {
        name: SESSION_COOKIE_NAME,
        // Lax, not Strict: a Strict cookie is not sent on the redirect back from Google.
        options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      },
    },
    pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
    trustHost: true,
    logger: {
      // Auth.js errors can carry request details; log their names only.
      error: (error) => console.error("Auth error", { error: error.name }),
      warn: (code) => console.warn("Auth warning", { code }),
      debug: () => {},
    },
    callbacks: {
      signIn({ account, profile }) {
        const decision = decideSignIn({
          provider: account?.provider,
          email: profile?.email,
          emailVerified: profile?.email_verified,
          church: hostChurch?.slug ?? null,
          team: hostChurch ? getTeam(hostChurch) : [],
        });
        logSignInDecision(decision, hostChurch?.slug ?? null);
        return decision.ok;
      },
      jwt({ token, trigger, profile }) {
        if (trigger !== "signIn") return token;
        if (!hostChurch || !profile?.email) return null;
        // Only who signed in, for which church, and when. Role, id and name are looked up
        // from the team list on every request, never stored in the token.
        const claims: SessionClaims = {
          church: hostChurch.slug,
          email: profile.email.trim().toLowerCase(),
          signedInAt: Date.now(),
        };
        return { sub: token.sub, ...claims };
      },
      session({ session, token }) {
        const parsed = sessionClaimsSchema.safeParse(token);
        const result = { expires: session.expires, claims: parsed.success ? parsed.data : null };
        return result as unknown as AuthSession;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) =>
  buildAuthConfig(request ? churchForHost(request.headers.get("host")) : null),
);
