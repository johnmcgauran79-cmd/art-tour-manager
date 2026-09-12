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

## Uploaded-files backup

`.github/workflows/storage-backup.yml` runs weekly (Sunday 17:00 UTC = 03:00 Monday Brisbane) and
can be run on demand from GitHub → Actions → "Supabase storage backup" → Run workflow. It uses the
same two secrets as the database backup (`SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_WEBHOOK_SECRET`) and
writes to `database-backups/storage/<date>/`, reporting `kind = 'storage'` to `backup-report`.

Verify: run the workflow, confirm it is green, confirm the parts exist in Storage, then check
Settings → System Health — "Uploaded files backup" should show days, not "Never reported".

## Restore drill (recommended quarterly)

Timebox: about 60–90 minutes. Never restore into production.

1. **Prepare.** Create a throwaway Supabase project (or local Postgres) and note the start time.
2. **Database.** Download the latest `art-backup-<date>.tar.gz` (workflow artifact, or rejoin the
   Storage parts as described above) and run:
   `psql "$TARGET" -f roles.sql && psql "$TARGET" -f schema.sql && psql "$TARGET" -f data.sql`
3. **Files.** Rejoin and extract the latest `art-storage-<date>.tar.gz.part-*`, then upload a sample
   of at least five objects from `storage-dump/<bucket>/...` into a scratch bucket and open them.
4. **Spot-check.** Compare row counts against production for `tours`, `bookings`, `customers`,
   `leads`, `crm_emails`, and confirm `storage-dump/manifest.json` object count matches Storage.
5. **Secrets and jobs.** Confirm the list in [07-env-secrets.md](07-env-secrets.md) is complete and
   that every `pg_cron` job in the restored database is present (their headers must be re-checked
   after any key rotation).
6. **Record** the elapsed time and outcome below, then delete the throwaway project.

| Date | Artifacts | Elapsed | Outcome | By |
| --- | --- | --- | --- | --- |
| — | — | — | Not yet rehearsed | — |


## Known outstanding item

The cron job `sync-keap-tags-nightly` (job id 9) calls a function that no longer exists, so it
fails every night. It was created by a different database role and cannot be removed by the
app's migration role. Remove it once from the Supabase dashboard SQL editor:

```sql
SELECT cron.unschedule(9);
```

## Source-code backup

`.github/workflows/code-backup.yml` runs daily (16:30 UTC = 02:30 Brisbane) and on demand from
GitHub → Actions → "Source code backup" → Run workflow. It uses the same two secrets as the other
backups (`SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_WEBHOOK_SECRET`), writes 40MB parts of a verified
`git bundle --all` to `database-backups/code/<date>/`, and reports `kind = 'code'` to
`backup-report`. Settings → System Health flags it after 48 hours.

Verify: run the workflow, confirm green, confirm the parts exist in Storage, then rejoin them and
run `git clone art-code-<date>.bundle art-restored` to prove the bundle opens.

## SharePoint and local copies

Every backup workflow also copies its parts to a SharePoint document library
(`ART Admin Backups/<kind>/<date>/`) via `.github/scripts/sharepoint_upload.py`. The step is
optional and never fails a run: it skips when `SHAREPOINT_SITE_PATH`, `MS_GRAPH_TENANT_ID`,
`MS_GRAPH_CLIENT_ID` or `MS_GRAPH_CLIENT_SECRET` is missing from the repository secrets, and is
marked `continue-on-error`. Verify by running a workflow and confirming the dated folder appears
in SharePoint; the reported destination in `backup_runs` lists both targets.

An offline copy can be pulled at any time with `scripts/local-backup-pull.ps1` (Windows) or
`scripts/local-backup-pull.sh` (mac/Linux) — see [24-backup-recovery.md](24-backup-recovery.md).
Include a local pull in each quarterly restore drill so the fourth copy is exercised too.
