# 09 — Deployment

## What is deployed where

| Piece | Where it runs | How it deploys |
| --- | --- | --- |
| React SPA | Lovable hosting | Published from the Lovable project; the published build is what serves the custom domain |
| Edge functions | Supabase (Deno) | Deployed to the Supabase project; deployment is automatic when function code changes through the Lovable/Supabase pipeline |
| Database changes | Supabase Postgres | Applied as forward migrations (see [05-migrations.md](05-migrations.md)) |
| Scheduled jobs | Supabase `pg_cron` | Defined as database rows in `cron.job`, calling functions via `pg_net` |

## URLs

| Purpose | URL |
| --- | --- |
| Production (custom domain) | `https://admin.australianracingtours.com.au` |
| Published Lovable URL | `https://art-tour-manager.lovable.app` |
| Preview | `https://id-preview--0332a293-c965-4d68-9941-88dfa7efbbcc.lovable.app` |
| Supabase functions base | `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/<name>` |

The custom domain is connected through Lovable's domain configuration. DNS for the sending domains (including the `news.` marketing subdomain) is managed separately — that subdomain is send-only and has no inbox.

## Deploy sequence for a normal change

1. Frontend-only change → merge to the main branch → publish → verify on the custom domain.
2. Change touching an edge function → the function redeploys with the code; verify by exercising the feature and reading function logs.
3. Change needing schema → migration first, then regenerate types, then ship the frontend that depends on it. Never ship a frontend that expects a column that is not live yet.
4. Change touching a scheduled job → the cron row must be updated in the database as well as the function code.

## Rollback

- **Frontend:** republish a previous version from the Lovable project history, or revert the commit and republish. This is the fast, safe path.
- **Edge function:** revert the function source and redeploy. Function deploys are quick, so reverting is the preferred remedy over hot-patching.
- **Database:** there is no automatic down-migration. A schema rollback means writing a new forward migration that reverses the change. Data loss from a destructive migration is only recoverable from backup — see [24-backup-recovery.md](24-backup-recovery.md).
- **Cron:** disable the job row rather than deleting it, so the schedule and payload are recoverable.

## Things that will bite you

- A published frontend is served to staff immediately; there is no staged rollout.
- Cron jobs carry authorisation headers inside the SQL `command`. If keys are ever rotated, every affected `cron.job` row must be updated or the jobs will silently fail.
- Several functions are called by both cron and the interface. Check both callers before changing a function's request contract.
