# 11 — Edge functions and scheduled jobs

88 functions live in `supabase/functions/`, plus a `_shared/` library. Nearly all are configured `verify_jwt = false` and authorise their own callers — see [06-security-rls.md](06-security-rls.md).

## Shared library — `supabase/functions/_shared/`

| Module | Purpose |
| --- | --- |
| `leadIntake.ts` | Single implementation of contact matching, lead/tour-interest creation, task creation, consent and attribution for every lead source |
| `marketingTracking.ts` | Open/click recording, link classification, safe HTTP(S) redirect handling |
| `artAiDates.ts` | Standardised date grounding for the assistant and deterministic skills |
| Others | Shared CORS, Supabase client, email layout and helper utilities |

Changing anything here changes several endpoints at once.

## Functions by area

**Customer token flows (public):** `validate-profile-token` / `update-customer-profile` / `send-profile-update-request`, `validate-travel-docs-token` / `update-travel-docs` / `send-travel-docs-request`, `validate-waiver-token` / `submit-waiver` / `send-waiver-request`, `validate-pickup-token` / `submit-pickup-selection` / `send-pickup-request`, `validate-custom-form-token` / `submit-custom-form` / `send-custom-form-request`, `validate-itinerary-token` / `send-itinerary-email`, `validate-host-briefing-token` / `send-host-briefing-email`, `email-file`.

**Transactional email:** `send-booking-confirmation`, `send-welcome-email`, `send-rooming-list`, `send-passport-report`, `send-activity-passenger-list`, `send-approved-payment-receipts`, `send-test-automated-report`, `resend-webhook` (delivery, bounce, open, complaint → `email_events`, `email_suppressions`).

**Scheduled email/report processors:** `process-automated-emails`, `process-scheduled-emails`, `process-status-change-emails`, `process-post-booking-emails`, `process-travel-docs-emails`, `process-automated-reports`, `process-scheduled-reports`.

**Reports and documents:** `generate-booking-changes-report`, `generate-rooming-list-report`, `generate-passenger-list-report`, `generate-activity-matrix-report`, `generate-payment-status-report`, `generate-itinerary-document`, `generate-guest-document-docx`.

**Marketing:** `marketing-send-campaign`, `process-scheduled-campaigns`, `marketing-track`, `marketing-submit-lead`, `marketing-landing-page`, `marketing-preferences`.

**CRM:** `crm-automation-run`, `crm-reprocess-submission`, `migrate-passenger-names`.

**Lead capture:** `lead-intake`, `lead-integration-keys`, `meta-leads-webhook`.

**Microsoft 365:** `ms-mail-sync`, `ms-mail-send`, `ms-mail-attachment`.

**Teams:** `send-teams-notification`, `notify-tour-status-teams`, `notify-website-change-teams`, `teams-oauth-start`, `teams-oauth-callback`, `teams-disconnect`.

**Xero:** `xero-oauth-callback`, `xero-webhook`, `xero-create-invoice`, `sync-xero-contacts`, `sync-xero-phones`, `sync-xero-states`, `sync-xero-payment-receipts`.

**WordPress:** `wp-content-proxy`.

**Tasks:** `send-task-notification`, `process-task-digests`, `process-task-due-alerts`.

**Platform / housekeeping:** `mcp`, `art-ai-chat`, `purge-ai-conversations`, `purge-passport-data`, `archive-completed-tours`, `refresh-tour-alerts`, `backup-report`, `delete-user`, `reset-user-password`.

## Scheduled jobs (live `cron.job` rows, 15 total, all active, UTC)

| Job | Schedule (UTC) | Calls |
| --- | --- | --- |
| `ms-mail-delta-sync` | every 15 min | `ms-mail-sync` (`{"mode":"delta"}`) |
| `process-scheduled-emails` | every 5 min | `process-scheduled-emails` |
| `process-scheduled-campaigns` | every 5 min | `process-scheduled-campaigns` |
| `process-task-digests` | every 15 min | `process-task-digests` |
| `process-task-due-alerts` | every 15 min | `process-task-due-alerts` |
| `crm-automation-run` | hourly at :20 | `crm-automation-run` (`{"source":"cron"}`) |
| `auto-archive-completed-tours` | 02:00 daily | `archive-completed-tours` |
| `purge-ai-conversations-daily` | 03:15 daily | `purge-ai-conversations` |
| `sync-xero-payment-receipts-daily` | 04:00 daily | `sync-xero-payment-receipts` |
| `xero-auto-sync-contacts` | every 4 hours | `sync-xero-contacts` |
| `sync-keap-tags-nightly` | 17:00 daily | `sync-keap-tags` |
| `process-daily-automated-emails` | 19:00 daily | `process-automated-emails` |
| `process-daily-automated-reports` | 20:00 daily | `process-scheduled-reports` |
| `process-post-booking-emails-daily` | 20:00 daily | `process-post-booking-emails` |
| `refresh-tour-alerts-weekly` | Sunday 00:00 | `refresh-tour-alerts` |

Notes and cautions:

- Daily times are UTC. 19:00/20:00 UTC lands in the following Australian morning; that is intentional for the daily send window but is easy to misread.
- `sync-keap-tags-nightly` points at a function name that is **not** present in `supabase/functions/`. Keap is contact-matching only now, so this job most likely fails silently every night. Recorded as a known issue in [25-known-issues-debt.md](25-known-issues-debt.md) — not changed here.
- Authorisation headers are embedded in each job's SQL command. Rotating keys requires updating every job row.
- `purge-passport-data` exists as a function; confirm whether it is scheduled before relying on automatic passport purging (`UNVERIFIED`).
