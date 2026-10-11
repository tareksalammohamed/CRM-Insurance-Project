# Reliability and usability upgrade — October 2026

This change strengthens shared application infrastructure and operational list loading. Pricing tables, calculation engines, grouping rules, target rules, roles, SQL functions and migrations are unchanged.

## Changes

- Customer and policy requests use generation guards so older searches, branch changes, permission lookups and unmounted pages cannot publish stale results. Agent options load independently of search and pagination.
- Customer, policy and first-year collection lists expose persistent cached/failed-read messages with retry. Scope changes reset the previous list and summary.
- Auth bootstrap and profile loading cannot overwrite newer sign-out/account-change events. Token refresh retains the current profile. Failed profile loading provides retry/sign-out actions, and last-login writes are secondary.
- Local read caches are namespaced by account. Reads started before an identity change are discarded. React Query is cleared when identities change.
- Offline sync acquires its lock before IndexedDB access, checks the active account between awaits, and retains payments when status/duplicate lookups fail. Existing payment/cancellation rules and operation IDs are retained.
- Connection subscribers share one channel and one probe, clean up when unused, and defer socket reconnects to Supabase's client. Failed health responses do not announce reconnection.
- A read's timeout is a total deadline; a stalled request is not launched repeatedly after timeout.
- PWA updates wait for explicit activation. Cached hashed assets do not generate background fetches. Only static assets are cached, server errors cannot replace the cached app shell, and the prior build/unrelated caches are retained. The update button handles errors and times out safely.
- Shared mobile KPI cards and headings are more compact. Filters respect browser dark controls. Dialogs trap keyboard focus, restore focus and handle nested Escape/scroll locks. Search-clear restores focus. Browser zoom is allowed. Unknown routes show a recovery page. Rejected lazy modules offer a full reload.
- CI runs lint, TypeScript, regression tests, help coverage and production build.

## Validation

`npm run check` passes. The suite includes 50 tests covering known pricing output, pension options (0/25/50 percent cash, divisor 89, 120 payments), commissions/payment dates, cancellation eligibility and collection denominator, request races, auth races, cache isolation, offline queue errors/concurrency, network lifecycle, service worker behavior, nested dialogs, theme storage failures and search focus.

Lint has zero errors and 258 existing warnings (primarily legacy `any` types). The pre-existing AdminDashboard lint error was fixed without changing its behavior.

## Limits and release checks

Tests mock backend responses and exercise pure existing business calculations; they do not prove production integration, RLS, PDF layout, AI extraction, or actual payment execution. No production database changes or financial operations were performed. Browser download/launch was unavailable in this environment; full visual and live end-to-end verification is outstanding.

Before releasing, verify existing-role login, branch switching, lists on a small mobile screen in light/dark modes, nested payment dialogs, printed offers/reports, offline reconnect and explicit PWA update. Cache namespacing starts a fresh cache for accounts using the prior unscoped format; an online load is required to repopulate it. The already-installed v4 worker used automatic activation; users may need one initial reload to adopt the new worker behavior.

Existing policy grouping still loads a bounded matching list before pagination. It was not changed to row-based server pagination because that would split policy groups and alter display behavior. There is no continuous production monitoring or guarantee against every future defect; CI detects the covered regressions.

## Dependency audit

Compatible dependency patches were applied. Vite is pinned to 7.3.7, the React plugin to 5.2.0, and Vitest to 5.0.3. Node >=22.12 is required; CI uses Node 22. The existing `es2018` browser build target and manual chunk configuration are retained.

The audit dropped from 21 findings to 8, with zero critical findings. Remaining high/moderate findings concern existing Tailwind 3 transitive build dependencies and SheetJS/XLSX. Resolving the former requires a Tailwind 4 styling/build migration; SheetJS has no fixed release in its existing npm distribution. These are not represented as resolved. Dependency patching and toolchain upgrades were validated by the complete check command.
