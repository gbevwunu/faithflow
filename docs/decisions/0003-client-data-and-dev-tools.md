# 0003: Client data and development tools

- Status: Accepted
- Date: 2026-10-04

## The browser gets only what the screen needs

Server components reduce data to the fields the screen displays before anything is sent to the browser. For the attendance roster that is each person's id, first name, last name, list (member or newcomer), the last four digits of their phone, and their mark as `{ markedByName, markedAt }` or null. Full phone numbers, emails, newcomer details (birthday, occupation, consent) and team member ids never leave the server. Server action responses follow the same rule, and error messages carry no personal data. Attendance is only loaded for a signed-in team member.

## Server actions trust nothing from the browser

Mark and unmark actions validate their input with Zod, take the acting team member from the session, check the marking window for that member's role, compute the service date from the server's clock, and verify the person is on the church's roster. Unknown fields such as a `markedBy` sent by the browser are discarded.

## The fake session and fake clock are development-only

Until real sign-in exists, a fake session (team or admin, using the config's fake team members) and a fake clock (to preview the lock and correction states) are available from a dev toolbar. Both are active only when `NODE_ENV` is `development` or `DEV_FAKE_SESSION=true` is set explicitly, for example on a preview deployment. On a production deployment (`VERCEL_ENV=production`) requesting them throws, so a misconfigured flag fails loudly instead of granting access. With them off there is no session, nothing is shown, and every attendance action is refused. The toolbar's own actions repeat the same check.
