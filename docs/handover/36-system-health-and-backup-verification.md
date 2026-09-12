# 36 — System health monitoring and backup verification

## System Health panel

Settings → System Health (admin/manager only) shows, in one place:

- every scheduled job, its cadence, last run and any failures in the last 24 hours
- failed background HTTP calls in the last 24 hours
- last database backup, and how long ago the last successful one was
- mailbox syncing status per mailbox
- failed emails, Xero sync errors and CRM/marketing automation errors in the last 24 hours

Backed by `public.get_system_health()` (SECURITY DEFINER, requires admin or manager) via
`src/hooks/useSystemHealth.ts` and `src/components/settings/SystemHealthCard.tsx`.

## Daily digest email

- Edge function: `supabase/functions/system-health-digest/index.ts`
- Data source: `public.get_system_health_service()` (service role only)
- Schedule: cron job `system-health-digest-daily`, `0 21 * * *` UTC = 07:00 Brisbane
- Recipients: every user with the `admin` role, using `profiles.email`
- Sends **only when at least one problem is detected**. `{"force":true}` sends regardless
  (this is what the "Email me a digest" button does). `{"preview":true}` returns the JSON
  without sending.
- Mailbox statuses treated as healthy: `success`, `completed`, `ok`, `running`, `in_progress`.

## Backups — current state and verification

The nightly backup runs in GitHub Actions (`.github/workflows/db-backup.yml`), uploads a
`.tar.gz` to the private `database-backups` Storage bucket, and reports the outcome to the
`backup-report` edge function, which writes a row to `backup_runs`.

As at the last check, `backup_runs` was **empty** and the bucket had **no objects**, meaning
the workflow had never completed successfully. `BACKUP_WEBHOOK_SECRET` has now been added on
the Supabase side; the same value must exist as a GitHub repository secret.

### Required GitHub repository secrets

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → connection string (pooler, with password) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `BACKUP_WEBHOOK_SECRET` | The same value saved as the Supabase secret of that name |

### Verify a backup end to end

1. GitHub → Actions → "Supabase database backup" → Run workflow.
2. Confirm the run is green and an artifact `art-backup-YYYY-MM-DD.tar.gz` is attached.
3. Supabase → Storage → `database-backups` → `database/` — confirm the same file exists.
4. ART Admin → Settings → System Health — "Last successful backup" should show hours, not
   "Never reported".

### Restore rehearsal (recommended quarterly)

1. Download the latest artifact and extract `roles.sql`, `schema.sql`, `data.sql`.
   (From Storage instead: download every `art-backup-<date>.tar.gz.part-*` file from
   `database/<date>/` and rejoin them with `cat art-backup-<date>.tar.gz.part-* > art-backup-<date>.tar.gz`,
   then `tar xzf` it. The archive is split into 40MB parts because Storage caps single-file size.)
2. Restore into a **throwaway** Supabase project or local Postgres, never production:
   `psql "$TARGET" -f roles.sql && psql "$TARGET" -f schema.sql && psql "$TARGET" -f data.sql`

3. Spot-check row counts for `tours`, `bookings`, `customers`, `leads`, `crm_emails`.
4. Record the date and outcome below.

| Date | Artifact | Outcome | By |
| --- | --- | --- | --- |
| — | — | Not yet rehearsed | — |

## Known outstanding item

The cron job `sync-keap-tags-nightly` (job id 9) calls a function that no longer exists, so it
fails every night. It was created by a different database role and cannot be removed by the
app's migration role. Remove it once from the Supabase dashboard SQL editor:

```sql
SELECT cron.unschedule(9);
```
