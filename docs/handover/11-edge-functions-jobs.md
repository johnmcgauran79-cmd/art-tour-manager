# 11 — Edge functions and scheduled jobs

84 functions live in `supabase/functions/`, plus a `_shared/` library. Nearly all are configured `verify_jwt = false` and authorise their own callers — see [06-security-rls.md](06-security-rls.md).

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
| `process-daily-automated-emails` | 19:00 daily | `process-automated-emails` |
| `process-daily-automated-reports` | 20:00 daily | `process-scheduled-reports` |
| `process-post-booking-emails-daily` | 20:00 daily | `process-post-booking-emails` |
| `refresh-tour-alerts-weekly` | Sunday 00:00 | `refresh-tour-alerts` |

Notes and cautions:

- Daily times are UTC. 19:00/20:00 UTC lands in the following Australian morning; that is intentional for the daily send window but is easy to misread.
- The old `sync-keap-tags-nightly` job was unscheduled on 18/09/2026 and its stale deployed function deleted; Keap is gone from the system entirely.
- Authorisation headers are embedded in each job's SQL command. Rotating keys requires updating every job row.
- `purge-passport-data` exists as a function; confirm whether it is scheduled before relying on automatic passport purging (`UNVERIFIED`).

## Instalment reminders (September 2026)

- `queue-instalment-reminders` — cron `queue-instalment-reminders-nightly` at `30 16 * * *` UTC (2:30am Brisbane, after the Xero receipt sync). Takes the `xero_api` lock. Finds tours with `instalment_required` whose `instalment_date` has passed (excluding `past`/`archived`/`cancelled`, `manual_billing`, `manual_emails`), collects chaseable bookings (excludes cancelled, waitlisted, host, complimentary, racing_breaks_invoice, fully_paid, instalment_paid and per-booking `manual_emails`/`manual_all` overrides), groups them by `xero_invoice_mappings.xero_invoice_id`, then reads each invoice live from Xero (300 ms spacing, 429 retry) for currency, total, paid, due, due date and the online-invoice payment link. Shortfall = `pax x (deposit_required + instalment_amount) - AmountPaid`. Rows are upserted into `instalment_reminders` (unique per tour + invoice); paid/voided invoices flip to `resolved`; invoices addressed to a non-passenger Xero contact are held as `held_agent`; bookings with no invoice mapping are returned as `unlinked_bookings` rather than emailed. Nothing is queued when Xero is unreachable.
- `send-instalment-reminders` — actions `send`, `skip` (push `next_due_at` a week), `stop` (state `stopped` + reason), `resume`. Sending renders the `instalment_reminder` email template (brand resolution, sender identity, currency symbol map, Resend 600 ms spacing), CCs passenger 2, logs to `email_logs`, increments `reminder_count` and sets `next_due_at` a week out, so unpaid invoices reappear weekly until paid or stopped.
### Final balance invoices and automatic chasing (update)

- `queue-instalment-reminders` now produces **two kinds** of row in `instalment_reminders` (`kind = 'instalment' | 'final'`), unique per tour + invoice + kind. The final-balance kind is created once a tour's `final_payment_date` has passed, chases the whole outstanding balance (`shortfall = AmountDue`), and stores the invoice's `LineItems` in `line_items` so the email can reproduce the full invoice. `instalment_paid` bookings are excluded from instalment reminders but still chased for the final balance. Live invoice reads are cached per invoice across both kinds.
- **Automatic sending:** the first email on each invoice stays `pending` and needs a person; every later chase is sent by the nightly job itself (instalments every 14 days, final balances every 7). After `MAX_REMINDERS` (3) emails the row flips to `needs_call` with a note to phone the client. Admins can `pause_auto` on a row, `skip`, `stop` (with a reason) or `resume`.
- Both emails include the invoice number and the cancellation policy (per-tour override, else the `cancellation_policy` general setting, honouring `cancellation_policy_enabled`). Merge fields: `{{invoice_line_items}}`, `{{cancellation_policy}}`, `{{amount_now_due}}`, `{{reminder_number}}` alongside the existing ones. Final-balance wording lives in `email_templates` type `final_balance` ("Final Balance Due").

- UI: Communications → **Payment Reminders** (Instalment payments / Final balances tabs) (`src/components/communications/InstalmentRemindersPanel.tsx`, `src/hooks/useInstalmentReminders.ts`). Sending, skipping and stopping require admin/manager.
- Wording lives in `email_templates` type `instalment_reminder`; bank details come from the `bank_details_html` general setting (placeholder values seeded — must be replaced with the real account details).

## Deposit reminders and reminder operations (late September 2026)

- `instalment_reminders.kind` now has a third value, `deposit`. `queue-instalment-reminders` creates a deposit row when a booking's deposit is still unpaid **10 days** after the booking was made. Amount owing = `deposit_required x pax` less anything already paid or credited in Xero, capped at the invoice balance. Deposit rows chase **weekly**, stop after `MAX_REMINDERS` (3) and then flip to `needs_call`. Wording lives in `email_templates` type `deposit_reminder` ("Deposit Payment Due") and opens by thanking the client for booking, naming the tour and stating the amount owing.
- **Invoice matching fallback:** bookings with no `xero_invoice_mappings` row are no longer skipped. The queue parses `bookings.invoice_reference` into tokens (split on `[,;/|]+` or " and "), looks each up via Xero `Invoices?InvoiceNumbers=`, caches results per run, groups the booking under the matched invoice and upserts a `xero_invoice_mappings` row (`onConflict: "booking_id,xero_invoice_id"`) so later runs skip the lookup. Bookings that still cannot be matched are returned in `not_chased` with a reason.
- **Hold and skip reasons** are explicit and surfaced in the UI: invoice still a DRAFT in Xero (approve it first), invoice addressed to a travel agent / third party (name shown), no invoice raised yet, invoice number not found in Xero, voided invoice, nothing owing. Name matching ignores repeated whitespace, so an invoice in the passenger's own name is not falsely flagged.
- `racing_breaks_invoice` bookings are excluded from **all three** kinds via `EXCLUDED_STATUSES`.
- Stale rows are cleaned up on every run: for each tour + kind, any pending/sent/held_agent/needs_call row whose invoice is no longer in the active list is set to `resolved`, so invoices paid outside the system drop off the list.
- New columns on `instalment_reminders`: `kind`, `line_items`, `final_payment_date`, `escalated_at`, `auto_send`, `invoice_date`, `booked_at`. Unique per tour + invoice + kind.
- `send-instalment-reminders` actions: `send`, `skip` (push a week), `stop` (+ reason), `resume`, `pause_auto`, `remove`. **`remove`** takes the row off the list permanently with a note and the nightly queue will not re-create it — use it when a reminder is deliberately abandoned (e.g. a small residual deposit covered by a credit). It also supports `test_mode` with `override_recipient_email` for "Send test to me" (subject prefixed `[TEST]`, nothing logged, no CC to passenger 2).
- Both reminder emails render a Xero-style invoice: tour title on its own line, bold section headings (Tour Inclusions, Tour Exclusions, Payment Schedule), one bullet per inclusion, separated deposit/instalment/final lines, bank details from the `bank_details_html` general setting (Settings → Invoice Management → Bank Details), then a "View invoice" button above a full-width "Pay by card" button, then the cancellation policy. The due date shown is the **invoice due date pulled from Xero** (bolded and highlighted), not the tour's final payment date. The header banner renders at roughly half width, centred.
- UI: Communications → **Payment Reminders**, tabs Deposits / Instalment payments / Final balances (`src/components/communications/InstalmentRemindersPanel.tsx`, `src/hooks/useInstalmentReminders.ts`). Deposit rows show the booking date and invoice date instead of a final payment date, and each tab lists "Not being chased" with reasons. The tab badge (`useInstalmentReminderDueCount`) counts only rows a person must action (`pending`, `held_agent`, `needs_call`); the panel heading shows the same "to action" figure plus the total number of lines on the list — these two deliberately differ from each other in meaning and must stay consistent in wording.
