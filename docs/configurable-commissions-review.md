# Configurable commissions and usability review — 2026-10-20

## Using the settings

System administrator → Settings → Commission rates. There are two percentage inputs: year one and a shared year-two/year-three rate. Existing values remain **2.2%** and **0.05%** of sum assured. The renewal value is not 5% or 0.0005%.

Choose an effective payment date from tomorrow onward in Africa/Cairo. A future entry can be edited by selecting its row; choosing an existing future date updates that entry. Effective and historical entries cannot be modified by client roles. Rates are global across branches, matching the previous global constants. The latest applicable version is chosen by actual payment date, not payout month. Existing installment divisors and payout dates (12/27 with 15/16 cutoff) are unchanged. A missing/failed rate load stops the displayed calculation rather than silently using default percentages.

Only schedule configuration is persisted; no financial transactions, premiums, commission payment records, pricing tables, monthly closing calculations or memo wording are changed. Original percentages are seeded as the baseline. The new table is RLS-protected, readable by signed-in users and writable only by system administrators for future dates. Anonymous access and deletes are revoked; database constraints validate rates. updated_by and updated_at identify the last editor.

## Review and completed improvements

- Settings: explicit load failure/retry, confirmed affected row when saving, validation messages, refresh shared branding after changes, separate commission save action and clear percentage/date guidance.
- Commission page: latest-request guards and scoped cleanup avoid older month/account results overwriting current results; persistent read-health notices; empty month input cannot crash date parsing.
- Commission reads: server-side owner/branch filters through inner relationships, deterministic 500-row pagination for both years, parallel independent reads. Avoids whole-branch downloads and truncation at the API row cap.
- Backup: deterministic 500-row reads of every table, progress showing rows collected, no downloaded partial file after failure. Includes settings and commission versions. XLSX loads only when exporting. This is a data export, not a transactional database snapshot or a backup of storage/auth configuration.
- Shared interface: compact density, larger text and reduced motion preferences, saved safely per device. Available in Settings and Profile; screen-only styles preserve printed reports. Improved focus outlines and dark native date/month controls. Header notifications reject stale requests after account changes.
- Help: commission payout documentation corrected from obsolete 5/20 to actual 12/27 behavior; configuration and history rules documented in the in-app guide.

## Validation and limits

- Full check: help-route coverage, lint, TypeScript, regression/component tests, production build.
- Real Supabase: migration applied; baseline verified; transactional RLS tests passed for administrator future insert/update, historical protection, invalid percentages, member read/write restrictions and anonymous/delete denial. Test schedule rows rolled back; one baseline row remains.
- Read-only anonymous REST probes with a nonexistent owner returned HTTP 200/empty results for both nested commission query shapes; this verifies query parsing/relationships, not an authenticated user's full workflow.
- Security advisor reports no finding for the new table. Existing notices remain for intentional auth entry points, existing authenticated SECURITY DEFINER functions, WebAuthn service-only challenges and disabled leaked-password protection. These were not changed as part of rate configuration. [Advisor reference](https://supabase.com/docs/guides/database/database-linter) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Full browser visual and signed-in end-to-end verification remain outstanding in this environment. No claim of exhaustive review of every workflow or permanent freedom from maintenance. Existing lint warnings and previously documented dependency findings remain. Further UI changes should be evaluated on real mobile screens rather than assuming visual correctness from builds.
