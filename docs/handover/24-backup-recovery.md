# 24 — Backup and recovery

## What protects the data

1. **Supabase platform backups.** The managed Postgres project has the backup and point-in-time recovery capability of its current plan. This is the primary protection and lives in the Supabase dashboard, not in this repository. The exact retention window and whether PITR is enabled is `UNVERIFIED` here and must be confirmed in the dashboard.
2. **Nightly database backup.** `.github/workflows/db-backup.yml` dumps roles/schema/data, uploads a split archive to the private `database-backups` bucket under `database/<date>/`, and reports to `backup-report`, which writes a `backup_runs` row (`kind = 'database'`). Authenticated with `BACKUP_WEBHOOK_SECRET`.
3. **Weekly uploaded-files backup.** `.github/workflows/storage-backup.yml` runs Sunday 17:00 UTC (03:00 Monday Brisbane). `.github/scripts/storage_backup.py` downloads every object from every Storage bucket except `database-backups` (attachments, contact avatars, email assets/attachments, operations documents), writes `manifest.json`, tars it, splits into 40MB parts and uploads to `database-backups/storage/<date>/`. Reports `kind = 'storage'`.
4. **Code history.** The GitHub repository is the frontend/function history. Reverting code is straightforward; reverting data is not.
5. **Nightly source-code backup.** `.github/workflows/code-backup.yml` runs 16:30 UTC daily (02:30 Brisbane), creates a `git bundle ... --all` (full history, every branch and tag), verifies it, attaches it as a 90-day workflow artifact, and uploads 40MB parts to `database-backups/code/<date>/`. Reports `kind = 'code'`. This protects the software itself against repository deletion, corruption or loss of GitHub access.
6. **SharePoint copy (third cloud location).** All three workflows end with a `Copy backup to SharePoint` step running `.github/scripts/sharepoint_upload.py`, which uploads the same split parts to `<site>/ART Admin Backups/<kind>/<date>/` in a SharePoint document library via Microsoft Graph. The step is `continue-on-error` and skips itself when the SharePoint secrets are absent, so it can never break the primary copies. The target is reported to `backup-report` appended to the Supabase destination.
7. **Local/offline copy (manual, on demand).** `scripts/local-backup-pull.ps1` (Windows) and `scripts/local-backup-pull.sh` (mac/Linux) download the newest database, storage and code backups from `database-backups`, rejoin the split parts, verify the code bundle and write them to a dated folder on any local or external drive.

Settings → System Health shows all three backups separately (`useBackupRuns.ts`, `get_system_health`): the database backup is flagged after 36 hours, the uploaded-files backup after 8 days, the source-code backup after 48 hours. The daily digest email raises the same three checks. Health tracking follows the backup *run*, not each destination; a SharePoint-only failure appears as a warning in the workflow log.

## SharePoint copy — setup

1. Microsoft Entra admin centre → App registrations → **Australian Racing Tours - Teams Notifications** → API permissions → add the Microsoft Graph **application** permission `Sites.ReadWrite.All` (or `Sites.Selected` plus a per-site grant), then **Grant admin consent**.
2. GitHub → repository → Settings → Secrets and variables → Actions, add:

| Secret | Value |
| --- | --- |
| `MS_GRAPH_TENANT_ID` | Directory (tenant) ID of the app registration |
| `MS_GRAPH_CLIENT_ID` | Application (client) ID |
| `MS_GRAPH_CLIENT_SECRET` | A client secret for that app |
| `SHAREPOINT_SITE_PATH` | e.g. `australianracingtours.sharepoint.com:/sites/Operations` |

   Optional repository **variable** `SHAREPOINT_FOLDER` overrides the default folder name `ART Admin Backups`.
3. Run any backup workflow manually and confirm the dated folders appear in the SharePoint library.

## Local copy — how to run

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
.\scripts\local-backup-pull.ps1 -Destination "D:\ART-Backups" -KeepDays 90
```

```bash
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"
./scripts/local-backup-pull.sh /Volumes/ART-Backups 90
```

Both write `<destination>/<date>/art-backup-<date>.tar.gz`, `art-storage-<date>.tar.gz` and `art-code-<date>.bundle`, print sizes and verify the code bundle. Weekly is sufficient; Windows Task Scheduler can run it unattended. Treat the drive as sensitive — it holds a full copy of customer data.

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

## Retention in the Supabase bucket

Each workflow prunes its own prefix after a successful upload via `.github/scripts/prune_backups.py <kind> <keep>`:

| Prefix | Copies kept |
| --- | --- |
| `database-backups/database/` | 5 newest dated folders |
| `database-backups/code/` | 5 newest dated folders |
| `database-backups/storage/` | 3 newest dated folders (~334MB each) |

Dated folder names sort chronologically (`YYYY-MM-DD`), so pruning is a lexical sort and delete of everything before the last N. The step is `continue-on-error` and the script swallows API errors, so retention never breaks a backup. SharePoint and GitHub artifact copies are not pruned by this script.

## Honest limitations

- The full "rebuild everything" restore has **not been rehearsed end to end**; RTO and RPO are estimates. See [36-system-health-and-backup-verification.md](36-system-health-and-backup-verification.md) for the drill procedure and log.
- Copies outside Supabase (GitHub artifacts, SharePoint, the local drive) depend on their own retention and on someone running the local script.

- Restoring from a SharePoint copy is identical to restoring from Storage: download every part from the dated folder, `cat`/join them, then follow the restore steps above.
- `backup_runs` failures surface in Settings → System Health and the daily digest email; nothing else alerts.

