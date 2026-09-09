# 33 — Takeover checklist, suggested first change, and explicit non-handovers

## First session checklist

1. Clone the repository; read [01-architecture.md](01-architecture.md), [04-database.md](04-database.md), [06-security-rls.md](06-security-rls.md), [13-crm-business-rules.md](13-crm-business-rules.md) and [25-known-issues-debt.md](25-known-issues-debt.md).
2. Get Supabase dashboard access for project `upqvgtuxfzsrwjahklij` and confirm which backup/PITR plan is active.
3. Confirm every variable in [07-env-secrets.md](07-env-secrets.md) exists as a Supabase secret. Do not rotate anything yet.
4. `npm install`, create `.env` with the two `VITE_` values, `npm run dev`, and log in — remembering the dev server talks to **production data**.
5. Run `npm run lint` and `npx tsc --noEmit` and record the baseline.
6. Read `cron.job` in the database and reconcile it against [11-edge-functions-jobs.md](11-edge-functions-jobs.md).
7. Check `email_sync_runs`, `xero_sync_log`, `backup_runs` and `email_logs` for recent failures.
8. Walk the eight workflows in [28-critical-workflows.md](28-critical-workflows.md) read-only in the interface.
9. Confirm Microsoft admin consent and the Graph client secret expiry date.
10. Confirm the Xero connection is live and the nightly receipt sync succeeded.
11. Read the live schema before changing anything — do not trust the 416 migration files to fully describe it.
12. Note that CRM tables are empty by circumstance, not fault (see [12-crm.md](12-crm.md)).

## Suggested low-risk first change — NOT implemented

**A read-only "System Health" panel.** One screen (or one daily digest) listing recent failures already recorded in the database: failed `cron` runs, `email_sync_runs` with a non-ok status, `xero_sync_log` errors, `backup_runs` failures, and `email_logs` failures.

Why this is a good first change:

- Reads only; no writes, no schema change, no policy change, no sending.
- Uses data that already exists.
- Closes the largest gap in the system (no alerting — see [23-testing-observability.md](23-testing-observability.md)).
- Forces familiarity with hooks, permissions, design tokens and the deploy loop, with almost no risk.

Suggested shape: `src/hooks/useSystemHealth.ts` + a panel on the existing Data Health page, admin/manager only via `usePermissions`.

**This has deliberately not been built.** It is a recommendation for the first Codex session, not part of this handover.

## Explicit non-handovers — what was NOT done

This engagement was documentation only. None of the following happened, and none of it should be assumed:

- No refactoring, redesign, or code cleanup
- No dependency upgrades or additions
- No schema, migration, RLS, policy or grant changes
- No edge function changes or deployments
- No changes to sending, templates, marketing, CRM logic, or attribution
- No secret rotation, credential changes, or integration reconfiguration
- No MCP expansion or new tools
- No Phase 7 work of any kind
- No UI or UX changes
- No speculative bug fixes
- No hosting change, no Lovable disconnection, no migration off the current platform
- No implementation of the suggested System Health change above
- No performance tuning, indexing, or retention policy changes
- No test suite creation

## Things this documentation cannot give you

- Exact migration-vs-live schema reconciliation (`UNVERIFIED` — 416 files, never reconciled)
- Confirmed backup retention window and PITR status (must be read from the Supabase dashboard)
- Whether `purge-passport-data` is scheduled (`UNVERIFIED`)
- Measured RTO/RPO — restore has never been rehearsed
- Historical performance baselines — no APM has ever been in place
- Any secret value, client record, or email content, by design
