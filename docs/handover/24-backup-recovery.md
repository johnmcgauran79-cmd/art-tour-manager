# 24 — Backup and recovery

## What protects the data

1. **Supabase platform backups.** The managed Postgres project has the backup and point-in-time recovery capability of its current plan. This is the primary protection and lives in the Supabase dashboard, not in this repository. The exact retention window and whether PITR is enabled is `UNVERIFIED` here and must be confirmed in the dashboard.
2. **Nightly database backup.** `.github/workflows/db-backup.yml` dumps roles/schema/data, uploads a split archive to the private `database-backups` bucket under `database/<date>/`, and reports to `backup-report`, which writes a `backup_runs` row (`kind = 'database'`). Authenticated with `BACKUP_WEBHOOK_SECRET`.
3. **Weekly uploaded-files backup.** `.github/workflows/storage-backup.yml` runs Sunday 17:00 UTC (03:00 Monday Brisbane). `.github/scripts/storage_backup.py` downloads every object from every Storage bucket except `database-backups` (attachments, contact avatars, email assets/attachments, operations documents), writes `manifest.json`, tars it, splits into 40MB parts and uploads to `database-backups/storage/<date>/`. Reports `kind = 'storage'`.
4. **Code history.** The GitHub repository is the frontend/function history. Reverting code is straightforward; reverting data is not.
5. **Nightly source-code backup.** `.github/workflows/code-backup.yml` runs 16:30 UTC daily (02:30 Brisbane), creates a `git bundle ... --all` (full history, every branch and tag), verifies it, attaches it as a 90-day workflow artifact, and uploads 40MB parts to `database-backups/code/<date>/`. Reports `kind = 'code'`. This protects the software itself against repository deletion, corruption or loss of GitHub access.

Settings → System Health shows all three backups separately (`useBackupRuns.ts`, `get_system_health`): the database backup is flagged after 36 hours, the uploaded-files backup after 8 days, the source-code backup after 48 hours. The daily digest email raises the same three checks.

## Restoring the source code

1. Download every `art-code-<date>.bundle.part-*` from `database-backups/code/<date>/` (or the single `.bundle` from the GitHub run artifact).
2. `cat art-code-<date>.bundle.part-* > art-code-<date>.bundle`
3. `git clone art-code-<date>.bundle art-restored` — this yields a full repository with all history; add a new remote and push to recreate the GitHub repository.


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
- **Storage buckets** (attachments, avatars, email assets, operations documents) are separate from the database; they are covered by the weekly uploaded-files backup, and restoring them is a separate step from restoring the database.
- **Microsoft mailbox history** can be re-imported from Graph, so `crm_emails` is recoverable in principle — but only for the window Microsoft retains.

## Restoring uploaded files

1. Download every `art-storage-<date>.tar.gz.part-*` from `database-backups/storage/<date>/`.
2. `cat art-storage-<date>.tar.gz.part-* > art-storage-<date>.tar.gz && tar xzf art-storage-<date>.tar.gz`
3. `storage-dump/<bucket>/<original path>` mirrors the live layout, so files can be re-uploaded to the same bucket and path. `storage-dump/manifest.json` lists every object and its size for verification.

## Honest limitations

- The full "rebuild everything" restore has **not been rehearsed end to end**; RTO and RPO are estimates. See [36-system-health-and-backup-verification.md](36-system-health-and-backup-verification.md) for the drill procedure and log.
- There is no second region or independent copy of the database outside Supabase's own backups and this project's own Storage bucket.
- `backup_runs` failures surface in Settings → System Health and the daily digest email; nothing else alerts.

