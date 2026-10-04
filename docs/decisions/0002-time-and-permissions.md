# 0002: Time and permissions

- Status: Accepted
- Date: 2026-10-04

## Marking windows are computed in the church's timezone

Whether marking is open, and when it closes, is worked out from the church's configured IANA timezone using the built-in `Intl` API, never from the server's or the browser's clock settings. The service day, team lock time and correction end time are all wall-clock times in that zone, so 5:00 PM means 5:00 PM in Winnipeg on both sides of a daylight saving change. The current instant is the only input taken from the clock.

## Every permission and time rule is enforced on the server

The browser may show the marking window and a countdown, but the server checks the role and the window again on every mark and unmark and rejects anything outside it. Nothing the browser sends can open a closed window or grant a role.

## markedBy comes from the session, never the browser

The server sets `markedBy` (and `by` on unmark) to the signed-in user's team member id from their session. Requests from the browser never carry it, and any value they send is ignored.
