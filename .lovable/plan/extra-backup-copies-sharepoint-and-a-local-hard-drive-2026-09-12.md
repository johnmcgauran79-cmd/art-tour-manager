# Extra backup copies: SharePoint and a local hard drive

Today every nightly backup (database, uploaded files, software code) lands in two places: your own private Supabase storage area, and attached to the GitHub run. This adds a third cloud copy in SharePoint and a simple way to pull a copy onto a local/external drive.

## 1. Automatic copy to SharePoint

Each of the three backup jobs gets an extra final step that uploads the same files to a SharePoint document library, into dated folders:

```text
Documents/ART Admin Backups/
  database/2026-09-13/...
  storage/2026-09-13/...
  code/2026-09-13/...
```

Files are uploaded in the same 40MB parts already produced, so large archives upload reliably.

The upload uses your existing Microsoft app registration ("Australian Racing Tours - Teams Notifications"), so no new account or licence is needed. Two things you must do:

1. In the Microsoft admin area, grant that app permission to write to SharePoint sites, and approve it (same admin-consent step used for mailbox access).
2. In GitHub, add the app's three values plus the target site as repository secrets (names listed in the technical section below).

If SharePoint isn't configured yet, the jobs skip that step and still succeed — the existing two copies are unaffected.

Each run reports which copies succeeded, and Settings → System Health / the daily digest continue to flag anything stale or failed.

## 2. Local hard copy

A small script you run on your own PC (or a spare machine) downloads the newest database, files and code backups from the private storage area, joins the split parts back into single archives, and saves them into a dated folder on whatever drive you point it at:

```text
D:\ART-Backups\2026-09-13\art-backup-2026-09-13.tar.gz
                          art-storage-2026-09-13.tar.gz
                          art-code-2026-09-13.bundle
```

It verifies the code bundle opens, prints the sizes, and can optionally delete folders older than a number of days you choose. You run it whenever you want a fresh offline copy — weekly is plenty — or schedule it with Windows Task Scheduler.

## 3. Documentation

The backup and recovery pages get updated: where each of the four copies lives, how to run the local script, how to restore from a SharePoint copy, and the SharePoint permission steps.

## Technical detail

- New shared step in `db-backup.yml`, `storage-backup.yml`, `code-backup.yml`: acquire a Graph token via client-credentials (`MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`), resolve the site via `SHAREPOINT_SITE_PATH` (e.g. `australianracingtours.sharepoint.com:/sites/Operations`), then `PUT /sites/{id}/drive/root:/ART Admin Backups/<kind>/<date>/<name>:/content` for each part (<=4MB parts use simple upload; larger use an upload session). Required app permission: `Sites.ReadWrite.All` (application) with admin consent — narrow to `Sites.Selected` if preferred.
- Step guarded by `if: env.SHAREPOINT_SITE_PATH != ''` and `continue-on-error` so it never breaks the primary copies; the `destination` reported to `backup-report` is extended to list all successful targets.
- Local script added as `scripts/local-backup-pull.ps1` (Windows) and `scripts/local-backup-pull.sh` (mac/Linux), using `SUPABASE_SERVICE_ROLE_KEY` from the operator's environment, listing objects under `database-backups/<kind>/` to find the latest date folder, downloading parts, `cat`-joining, and `git bundle verify` on the code bundle.
- No application, schema or edge-function changes.
