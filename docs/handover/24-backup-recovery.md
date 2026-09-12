# 24 — Backup and recovery

## What protects the data

1. **Supabase platform backups.** The managed Postgres project has the backup and point-in-time recovery capability of its current plan. This is the primary protection and lives in the Supabase dashboard, not in this repository. The exact retention window and whether PITR is enabled is `UNVERIFIED` here and must be confirmed in the dashboard.
2. **Nightly database backup.** `.github/workflows/db-backup.yml` dumps roles/schema/data, uploads a split archive to the private `database-backups` bucket under `database/<date>/`, and reports to `backup-report`, which writes a `backup_runs` row (`kind = 'database'`). Authenticated with `BACKUP_WEBHOOK_SECRET`.
3. **Weekly uploaded-files backup.** `.github/workflows/storage-backup.yml` runs Sunday 17:00 UTC (03:00 Monday Brisbane). `.github/scripts/storage_backup.py` downloads every object from every Storage bucket except `database-backups` (attachments, contact avatars, email assets/attachments, operations documents), writes `manifest.json`, tars it, splits into 40MB parts and uploads to `database-backups/storage/<date>/`. Reports `kind = 'storage'`.
4. **Code history.** The GitHub repository is the frontend/function history. Reverting code is straightforward; reverting data is not.

Settings → System Health shows both backups separately (`useBackupRuns.ts`, `get_system_health`): the database backup is flagged after 36 hours, the uploaded-files backup after 8 days. The daily digest email raises the same two checks.


## Recovery expectations

| Scenario | Response |
| --- | --- |
| Bad frontend deploy | Republish the previous version from Lovable, or revert the commit and republish |
| Bad edge function deploy | Revert the function file and redeploy; functions deploy independently of the frontend |
| Bad migration | Write a **new** forward migration that reverses it. Never edit or delete an applied migration |
| Accidental row deletion | Supabase point-in-time recovery, if enabled on the plan. There is no application-level undo for cascade deletes |
| Whole-project loss | Restore Supabase from platform backup, redeploy code from GitHub, re-add all secrets (they are not in the repository), and re-create the `pg_cron` jobs if they did not come with the restore |
| Integration credential loss | Re-issue in the third-party service and re-add as a Supabase secret |

## Things that are easy to forget in a restore

- **Secrets are not in backups you control.** Keep an offline record of *which* variables must exist (see [07-env-secrets.md](07-env-secrets.md)); the values must come from each provider.
- **`pg_cron` job rows contain their own authorisation headers.** After any key rotation or restore, verify all job rows.
- **Storage buckets** (attachments, avatars, documents) are separate from the database; confirm they are included in whatever backup regime is relied upon.
- **Microsoft mailbox history** can be re-imported from Graph, so `crm_emails` is recoverable in principle — but only for the window Microsoft retains.

## Honest limitations

- Restore procedure has **not been rehearsed**; RTO and RPO are unmeasured.
- There is no second region or independent copy of the database outside Supabase's own backups.
- `backup_runs` should be checked periodically because nothing alerts on a failed backup.
