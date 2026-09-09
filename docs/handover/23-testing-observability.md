# 23 — Testing and observability, honestly

## What exists

| Check | Command | Reality |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | Real and useful; the main safety net |
| Lint | `npm run lint` | Real |
| Production build | `npm run build` | Real |
| Deno tests for edge functions | `deno test` on `*_test.ts` files | The mechanism exists; coverage is minimal to none |

## What does not exist

- **No unit test suite.** `package.json` has no `test` script.
- **No integration or end-to-end tests.** No Playwright/Cypress suite in the repository.
- **No CI test gate.** The only GitHub workflow is `.github/workflows/db-backup.yml`.
- **No staging database.** Preview and production share one Supabase project. There is no safe place to test destructive database behaviour.

Verification to date has been: typecheck + build + manual exercise of the affected screen + reading edge function logs. Treat that as the baseline, not as adequate.

## Observability

| Signal | Where |
| --- | --- |
| Edge function logs | Supabase dashboard → Functions → *function* → Logs. Structured `console.log`/`console.error` only; no external log aggregation |
| Database activity | `audit_log`, `log_sensitive_operation`, `log_booking_changes`, `log_hotel_booking_changes`, `log_activity_booking_changes`, `task_activity_log` |
| Email outcomes | `email_logs`, `email_events`, `email_suppressions`, `automated_email_log`, `post_booking_email_log`, `status_change_email_queue` |
| Sync outcomes | `email_sync_runs`, `xero_sync_log`, `wordpress_integration_audit_logs`, `crm_automation_runs`, `marketing_automation_log`, `backup_runs` |
| Frontend errors | `ErrorBoundary.tsx` and the browser console only |

## Gaps that matter

- **No alerting.** If a cron job or a nightly sync fails, nobody is told; a person has to look. This is the single biggest operational blind spot.
- **No uptime or error-rate monitoring** of the frontend or functions.
- **No performance monitoring.** Slow queries can be inspected on demand in Supabase, but nothing is recorded over time.
- Failure states are discoverable but scattered across a dozen log tables rather than one place.

## Suggested first improvement (not implemented)

A single "system health" read-only screen or daily digest that surfaces failed cron runs, failed syncs and email failures in one view. Deliberately left undone — see [33-codex-takeover-checklist.md](33-codex-takeover-checklist.md).
