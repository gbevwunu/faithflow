# 0007: Sign-in

- Status: Accepted
- Date: 2026-11-05

## Google sign-in with Auth.js, production only

Team members sign in with their Google accounts through Auth.js (`next-auth` 5, pinned to an exact beta release) with JWT sessions and no database. Real sign-in runs only on the production deployment (`VERCEL_ENV=production`); previews and local development keep the fake session and dev toolbar from 0003, and the Auth.js routes answer 404 there. On production the fake session is never consulted, and setting `DEV_FAKE_SESSION` there still throws.

Auth.js lives behind `src/lib/server/auth.ts`, so the rest of the app depends only on `getSession`. Auth.js is now maintained by the Better Auth team; if it stops receiving fixes, only that module and the auth route need replacing.

## The team list is an environment variable

Each church's config names its team list variable (`teamEnv`, for NewBreed `NEWBREED_TEAM`). Its value is a single-line JSON array:

```
[{"id":"<uuid>","name":"<name>","email":"<google account email>","role":"team"}]
```

Ids are UUIDs and must never change, because the Tick Log's `markedBy` refers to them; reuse a person's old id if they rejoin. Emails are compared in lowercase and must be the exact Google account email. Ids and emails must be unique. A missing or invalid list means nobody can sign in, and the error logged names the variable and the problem only, never its contents. Team members are never in committed files.

## Membership is checked on every request

The session token records only who signed in (the verified Google email), for which church, and when. It holds no role, id or name. On every page render and server action, `getSession` reads the token and looks the email up in the church's team list as it is now; the team member id, name and role come from that list. Removing someone, or changing their role, takes effect on their next request once the redeploy with the new variable is live (Vercel applies changed environment variables on the next deployment). `markedBy` and every permission check keep coming from the session only.

Sign-in itself is allowed only for a verified Google email on the current team list of the church whose subdomain the sign-in came through. Successful sign-ins are logged with the team member id and church slug; refused ones with the reason and church slug. Emails and names are never logged.

## Churches stay separate

Sign-in is offered only on the church's own subdomain, where its Google redirect address is registered, and the church comes only from the Host header through `churchSlugFromHost`. Three checks keep churches apart: the session cookie is host-only, so another church's subdomain never receives it; the token's church must match the church being accessed; and each church has its own team list.

## Session cookie and lifetime

The session cookie is `__Host-authjs.session-token`: HTTP-only, Secure, SameSite=Lax, path `/`, no Domain. Lax rather than Strict, because a Strict cookie is not sent on the redirect back from Google. A session lasts 12 hours from sign-in, however much it is used, which covers a Sunday from morning through the corrections window. Members sign out from the attendance header.

## Rate limiting with the Vercel Firewall

Phone lookups and sign-in attempts are limited with Vercel WAF rate-limiting rules checked from code through `@vercel/firewall`, so no extra service is needed. Two rules use the `@vercel/firewall` condition and the fixed-window algorithm:

- `phone-lookup`: 60 requests per 10 minutes per team member, keyed `phone:<church>:<team member id>`. It covers looking up a phone, "tick them instead" and adding a newcomer, since a duplicate response also names a person. Over the limit, the action refuses with `rate-limited`.
- `sign-in`: 100 requests per 10 minutes per client IP, generous because volunteers share the church's Wi-Fi. Over the limit, sign-in answers 429 or shows a "try again" message.

Checks run on production only, with a 1-second timeout. If the check fails, the request is let through and the error name logged, so a firewall problem never locks volunteers out on a Sunday. Counters are per region.
