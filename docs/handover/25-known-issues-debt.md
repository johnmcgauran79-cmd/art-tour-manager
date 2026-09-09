# 25 — Known issues and technical debt

Evidence-backed only. Nothing here was fixed as part of this handover.

## High

| Issue | Evidence | Impact |
| --- | --- | --- |
| No alerting on any failure | No monitoring config anywhere; failures only land in log tables | A failed nightly Xero sync, campaign processor or mailbox sync can go unnoticed for days |
| Preview and production share one database | Single Supabase project ref in `.env` and `config.toml` | Any test that writes data writes production data. No safe rehearsal of destructive changes |
| Cron job points at a non-existent function | `sync-keap-tags-nightly` calls `sync-keap-tags`; no such directory in `supabase/functions/` | Job almost certainly fails nightly and silently; harmless functionally (Keap tagging was deliberately removed) but noisy and misleading |
| Restore never rehearsed | No runbook evidence, no recorded drill | Unknown recovery time in a real incident |

## Medium

| Issue | Evidence | Impact |
| --- | --- | --- |
| Almost every edge function is `verify_jwt = false` | `supabase/config.toml` | Correct for public/token/cron endpoints, but it means each function's own authorisation is the only guard. One missed check is a data exposure |
| No automated tests | No `test` script; no test suite in repo | Regressions are caught only by typecheck and manual checking |
| Migration/live drift unverified | 416 migration files; no reconciliation performed | Cannot assume the repository fully describes live schema. Always read live schema before changing it |
| Public forms have no CAPTCHA or rate limit | `marketing-submit-lead` validates shape only | Vulnerable to spam once the forms are promoted publicly |
| Config shape inconsistency | `crm_settings` uses typed columns, not key/value, contrary to what its name suggests; `crm_settings.id` presented as boolean in live output | Confuses anyone assuming a settings key/value table |
| Function count and duplication | 88 edge functions, several with overlapping responsibilities (multiple email processors, multiple report generators) | Hard to know which path a given email actually took |
| Cron times are UTC | `cron.job` schedules | Daily jobs at 19:00/20:00 UTC read as evening but run in the Australian morning; easy to misconfigure |

## Low / informational

| Issue | Evidence | Impact |
| --- | --- | --- |
| CRM has no production data yet | `leads`, `tour_interests`, `crm_activities`, `landing_page_submissions`, `campaign_events` all zero rows | CRM screens look empty; do not diagnose this as a bug |
| Click classifications not configured | `marketing_link_classifications` empty | Meaningful-click and tour-click intelligence produces nothing until configured |
| Automation rules not configured | `crm_automation_rules` and `marketing_automation_rules` empty | Automation is built but dormant |
| External integrations disabled | Meta and Zapier rows both disabled | No external leads flowing |
| `news.tours@` mailbox shows an error | `email_mailboxes` row, disabled, send-only subdomain | Expected and intentional — leave it |
| `purge-passport-data` schedule unconfirmed | Function exists; not clearly in `cron.job` | Passport retention may be manual rather than automatic (`UNVERIFIED`) |
| Large single files | `supabase/functions/mcp/index.ts` holds 117 tool definitions | Hard to navigate; refactoring is risky and out of scope |
