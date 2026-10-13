# 0004: Newcomer capture

- Status: Accepted
- Date: 2026-10-13

## Consent is recorded at capture

The add newcomer form asks whether the person agreed to receive messages from the church. The box starts unticked, saving is allowed either way, and the answer is stored with the newcomer as `consentToMessages`. Future messaging must check it rather than assume consent.

## Duplicate matches reveal minimal data

When a phone number already belongs to someone, the browser learns only their first name, last initial and which list they are on, for example "This number matches Kemi O. on the member list". The full record, phone, email and id stay on the server. "Tick them instead" sends the phone back and the server looks the person up again before marking them, so no identifier is exposed. Lookups, saving and "Tick them instead" all require a signed-in team member and follow the same marking window and roles as ticking.

Phone lookups confirm whether a number belongs to someone, so they need rate limiting per team member when real sign-in is added.

## Input is stored as plain text

Names and other fields are trimmed and otherwise stored exactly as entered, with no case changes or reformatting. Values that look like spreadsheet formulas, such as `=HYPERLINK(...)`, are ordinary text. The Google Sheets data source must write raw values so a cell can never be evaluated as a formula.
