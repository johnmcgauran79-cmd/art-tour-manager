# 25 — Known issues and technical debt

Evidence-backed only. Nothing here was fixed as part of this handover.

## High

| Issue | Evidence | Impact |
| --- | --- | --- |
| No alerting on any failure | No monitoring config anywhere; failures only land in log tables | A failed nightly Xero sync, campaign processor or mailbox sync can go unnoticed for days |
| Preview and production share one database | Single Supabase project ref in `.env` and `config.toml` | Any test that writes data writes production data. No safe rehearsal of destructive changes |
| Restore never rehearsed | No runbook evidence, no recorded drill | Unknown recovery time in a real incident |
| Restore never rehearsed | No runbook evidence, no recorded drill | Unknown recovery time in a real incident |

## Medium

| Issue | Evidence | Impact |
| --- | --- | --- |
| Almost every edge function is `verify_jwt = false` | `supabase/config.toml` | Correct for public/token/cron endpoints, but it means each function's own authorisation is the only guard. One missed check is a data exposure |
| No automated tests | No `test` script; no test suite in repo | Regressions are caught only by typecheck and manual checking |
| Migration/live drift unverified | 427 migration files; no reconciliation performed | Cannot assume the repository fully describes live schema. Always read live schema before changing it |
| Public forms have no CAPTCHA or rate limit | `marketing-submit-lead` validates shape only | Vulnerable to spam once the forms are promoted publicly |
| Config shape inconsistency | `crm_settings` uses typed columns, not key/value, contrary to what its name suggests; `crm_settings.id` presented as boolean in live output | Confuses anyone assuming a settings key/value table |
| Function count and duplication | 84 edge functions, several with overlapping responsibilities (multiple email processors, multiple report generators) | Hard to know which path a given email actually took |
| Cron times are UTC | `cron.job` schedules | Daily jobs at 19:00/20:00 UTC read as evening but run in the Australian morning; easy to misconfigure |

## Low / informational

| Issue | Evidence | Impact |
| --- | --- | --- |
| CRM has no production data yet | `leads`, `tour_interests`, `crm_activities`, `landing_page_submissions`, `campaign_events` all zero rows | CRM screens look empty; do not diagnose this as a bug |
| Click classifications not configured | `marketing_link_classifications` empty | Meaningful-click and tour-click intelligence produces nothing until configured |
| Automation rules not configured | `crm_automation_rules` and `marketing_automation_rules` empty | Automation is built but dormant |
| External integrations disabled | Meta and Zapier rows both disabled | No external leads flowing |
| `news.tours@` removed as a mailbox | Row deleted from `email_mailboxes` (send-only marketing subdomain, no Microsoft mailbox) | Do not re-add it; marketing replies route to bookings@ |
| `purge-passport-data` schedule unconfirmed | Function exists; not clearly in `cron.job` | Passport retention may be manual rather than automatic (`UNVERIFIED`) |
| Large single files | MCP tool definitions (146 tools, v2.8.0) split across `src/lib/mcp/tools/` but still large | Hard to navigate; refactoring is risky and out of scope |
| No authenticated browser testing | `LOVABLE_BROWSER_AUTH_STATUS = external_unmanaged` (external Supabase) | Only public routes can be verified end to end; signed-in flows are checked manually |

## Resolved in the September 2026 tidy-up

| Was | Now |
| --- | --- |
| Keap → Brevo migration console, `brevo-sync`, `crm-migrate-*`, Keap matching, `KEAP_API_KEY` | Removed. Historical `keap_contact_id` / `brevo_contact_id` kept as read-only history. Do not reintroduce |
| Non-functional "Coming Soon" settings cards and hard-coded "System Status" ticks | Deleted |
| Integration Status as a separate settings card | Section inside System Health / `/data-health` |
| Unreachable emergency contact CSV import | Removed |
| Sender identity duplicated in General Settings and Email Settings | Email Management → Email Settings only |
| Brands and theme in two places | Single "Branding & Appearance" settings tab |
| Data Quality as its own side-menu tab | Data quality tab on `/data-health` plus a Settings "Review Data" card |
| Merge button on duplicate contacts navigated to the contacts list | Opens the merge dialog with the duplicate set preloaded |
| Xero data-quality false positives (multi-invoice bookings, recorded invoice numbers) | Invoice checks normalise and token-match references, respect `xero_invoice_mappings`, and only cover upcoming (non-past/archived/cancelled) tours |
| No way to remove a booking's secondary contact | Remove button on the booking edit page clears it on save |
| Backups grew without limit | Prune step keeps 5 database, 5 code and 3 storage copies |
| Deposit reminders only chased bookings with a stored Xero mapping (4 of 22 owing) | Queue matches `invoice_reference` numbers against Xero and back-fills `xero_invoice_mappings` |
| Reminder rows stayed listed after an invoice was paid outside the system | Nightly cleanup resolves rows whose invoice is no longer active |
| No way to abandon a reminder permanently | `remove` action; the nightly queue will not re-create it |
| Cron job `sync-keap-tags-nightly` failed nightly against the dropped `tours.keap_tag_id` | Job unscheduled and the `sync-keap-tags` function deleted. `sync-n-tags-nightly` (job 9) is owned by `supabase_read_only_user` — do not alter |
| System Health digest counted expired background-log entries as failures | Health functions expose `http_failure_details_24h` / `recent_http_failures`; digest only sends when a genuine issue exists |
| Marketing editor preview did not match the delivered email | Negative spacing converted to padding at build time; editor renders at real content width |
| Deploy replacing a lazily-loaded chunk crashed navigation | `src/lib/chunkReload.ts` guard reloads once per 10 minutes |
| Bedding review screen duplicated validation | Removed; bedding is validated at booking create/edit/allocation via `src/lib/beddingRules.ts` |
| Bulk "Update Invoice" action on bookings | Removed — invoices are auto-generated |

