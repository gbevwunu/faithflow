# 0001: Data model

- Status: Accepted
- Date: 2026-10-04

## Member wins on shared phones

A phone can appear on both the member and newcomer lists, for example when a member is entered again as a newcomer. In that case the member record is the person: `findByPhone` returns the member and the roster shows only the member, so nobody can be marked twice.

## Idempotent marking keeps the first mark

`markPresent` on someone already marked for that service date returns the existing mark unchanged, including its `markedBy` and `markedAt`. `unmark` on someone without a mark does nothing. Retries and double taps are therefore safe.

## Opaque UUID ids

People are identified by random UUIDs from `crypto.randomUUID()`. Seed data uses fixed UUID strings so it stays deterministic. Ids are opaque: no code parses them or assumes a format.

## markedBy is a team member id

`markedBy` stores the team member's id from the church config, not their name or email. Names are resolved for display with `getTeamMemberName`, so a name or email change never rewrites history and marks carry no extra personal data.

## serviceDate is the church's local date

`serviceDate` is a `YYYY-MM-DD` calendar date in the church's configured timezone, never derived from server time or UTC. A service on Sunday in Winnipeg is that Sunday's date even when it is already Monday in UTC.

## The real data source must log unmarks

Removing a mark deletes it from the roster, but the real data source must also append an entry to the tick log recording who unmarked whom, when, and whether it was a correction. The mock does not keep this log; the `by` and `isCorrection` inputs to `unmark` exist for it.
