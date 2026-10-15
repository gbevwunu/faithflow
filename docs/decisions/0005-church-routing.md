# 0005: Church routing

- Status: Accepted
- Date: 2026-10-15

## A subdomain per church

Each church is served from its own subdomain, `<slug>.<ROOT_DOMAIN>`, for example `newbreed.faithflow.app`. `src/proxy.ts` rewrites `newbreed.<ROOT_DOMAIN>/attendance` to the internal route `/newbreed/attendance`, so the address the team sees stays short. Links inside the app use a base path that is empty on the church's own subdomain. The proxy never redirects: an unknown church subdomain is rewritten like any other and its layout answers 404, so no response ever points the browser at a location taken from the request. The bare root domain and reserved subdomains (`www`, `app`, `admin`, `api`) show the FaithFlow placeholder page.

## Path URLs as the fallback

Path-based URLs such as `/newbreed/attendance` keep working on every host. Vercel preview deployments get a generated domain that cannot carry church subdomains, and local development may use either `localhost:3000/newbreed/attendance` or `newbreed.localhost:3000/attendance`.

## Host validated against ROOT_DOMAIN

The church is read from the Host header only through `churchSlugFromHost`, a pure function. It accepts exactly one subdomain label of `ROOT_DOMAIN` (or of `localhost`), made of lowercase letters, digits and inner hyphens, after lowercasing and dropping a trailing dot and a numeric port. Every other host, including lookalike and foreign domains, resolves to no church, so a forged Host header cannot select a church through a domain we do not own. `ROOT_DOMAIN` comes from the environment and no domain is written into the code. A church chosen by host gets no more access than the same church chosen by path: every server action still checks the session, role and marking window.
