# 0006: Google Sheets data source

- Status: Accepted
- Date: 2026-10-15

## Keyless authentication

The app reaches Google Sheets without any service account key. On Vercel, each function receives a short-lived OIDC token. `src/lib/server/google-auth.ts` gives that token to Google's Security Token Service through Workload Identity Federation, then impersonates a single service account with the `https://www.googleapis.com/auth/spreadsheets` scope only. The project number, service account email, pool and provider IDs come from environment variables and are validated before any URL is built. The Sheets v4 REST API is called directly with the resulting access token.

## Separate service accounts for preview and production

Preview deployments authenticate as the church-sheets service account, which is shared only on the STAGING spreadsheet. Production will use a separate service account, shared only on the live spreadsheet. Each environment's Workload Identity Federation settings and `NEWBREED_SPREADSHEET_ID` point at its own account and sheet, so a preview deployment cannot read or change live data even if misconfigured.

## Columns are mapped by header

Each tab and each field's header text live in the church config. Every operation reads row 1 of the tabs it needs, finds each mapped header by exact text, and then requests only those columns in one batchGet. Column order in the sheet can change freely. A missing header stops the operation with an error naming the tab and header and nothing else.

## Immigration Status is never read

The members tab holds sensitive columns, including "Immigration Status". The app requests the header row and the five mapped columns of that tab, never any other column, so no cell from those columns ever reaches the server. Tests assert that no request names another members column and that no served cell comes from one.

## Person ID is the stable key

Every person has a UUID in "Person ID". Rows without one are left off the roster and only counted in the logs. Row numbers are never kept: before every write the app reads the Person ID column again and writes to the row where that ID is now, so sorting or inserting rows in the sheet cannot redirect a write to the wrong person.

## Stale Attended Church marks

"Attended Church" is a single column that should be cleared after each service. On a service day, anyone with "Yes" but no Tick Log "mark" entry for that day is treated as left over from a previous service: they are shown as not ticked so volunteers tick them fresh, and admins see a warning to check the weekly reset. The app never clears the column itself. On other days the column is shown as it is.

## Writes are RAW

Every write uses `valueInputOption=RAW`, so text that looks like a formula, number or date is stored exactly as typed. Ticks write "Yes" or "No" to "Attended Church" and append a Tick Log row recording when, which service date, who, which list, mark or unmark, the team member's id and whether it was a correction. New newcomers are appended as one row to the newcomers tab. The app never adds rows to the members tab. Writes from one server instance are serialized; concurrent instances can still race, which the form's double-submit guard and the Tick Log make visible.

## The seed tool only touches staging

The dev toolbar's "Seed staging sheet" fills an empty spreadsheet with fake people, for previews and testing. It is available only when development tools are enabled, refuses unless the spreadsheet title contains "STAGING", and refuses if any mapped column already has data. Seeded phones stay in the fictional 555-0100 to 555-0199 range.
