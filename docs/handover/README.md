# ART Admin — Technical Handover

This folder is the technical handover for the Australian Racing Tours admin system (ART Admin). It is **documentation only** — writing it changed no application code, no database object, no edge function, no integration and no credential.

Everything here was written from the live repository and the live Supabase project as at **8 September 2026**. Where something could not be confirmed, it is marked `UNVERIFIED` rather than guessed.

## Quick facts

| Item | Value |
| --- | --- |
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) |
| Supabase project ref | `upqvgtuxfzsrwjahklij` |
| Public admin URLs | `https://admin.australianracingtours.com.au`, `https://art-tour-manager.lovable.app` |
| Public tables | 145, all with row level security enabled, 405 policies |
| Migrations in repo | 416 files under `supabase/migrations/` |
| Edge functions | 88 functions plus a `_shared` library folder |
| Scheduled jobs | 15 pg_cron jobs |
| App pages | 38 under `src/pages/` |
| MCP server | `art-tour-manager-wordpress-mcp` v2.6.0, 117 tool definitions |

## Chapters

| File | Contents |
| --- | --- |
| [01-architecture.md](01-architecture.md) | System purpose, stack, runtime shape, architecture diagram |
| [02-repository-map.md](02-repository-map.md) | Folder map, entry points, generated vs hand-written files |
| [03-modules-routes.md](03-modules-routes.md) | Every route and module, who can reach it |
| [04-database.md](04-database.md) | Core tables, views, functions, triggers, ER diagram |
| [05-migrations.md](05-migrations.md) | Migration history, how changes apply, drift |
| [06-security-rls.md](06-security-rls.md) | Auth, roles, RLS, service-role paths |
| [07-env-secrets.md](07-env-secrets.md) | Variable and secret **names** only |
| [08-local-development.md](08-local-development.md) | Clone, install, run, build |
| [09-deployment.md](09-deployment.md) | Hosting, deploys, rollback, domains |
| [10-codex-workflow.md](10-codex-workflow.md) | Safe change loop for a new developer |
| [11-edge-functions-jobs.md](11-edge-functions-jobs.md) | All functions and cron jobs |
| [12-crm.md](12-crm.md) | CRM Phases 1–6 as actually built |
| [13-crm-business-rules.md](13-crm-business-rules.md) | Configured vs hard-coded rules |
| [14-email-marketing.md](14-email-marketing.md) | ART's own campaign system, tracking, attribution |
| [15-microsoft-email.md](15-microsoft-email.md) | Microsoft 365 / Outlook correspondence |
| [16-forms-lead-intake.md](16-forms-lead-intake.md) | Public forms and lead intake |
| [17-external-lead-integrations.md](17-external-lead-integrations.md) | Meta, Zapier, partner feeds |
| [18-wordpress.md](18-wordpress.md) | Website content sync |
| [19-mcp-current-state.md](19-mcp-current-state.md) | MCP as it stands (no expansion) |
| [20-teams-notifications.md](20-teams-notifications.md) | Teams and in-app notifications |
| [21-tours-bookings.md](21-tours-bookings.md) | Tours, bookings, statuses, capacity |
| [22-task-manager.md](22-task-manager.md) | Task Manager model |
| [23-testing-observability.md](23-testing-observability.md) | What is tested, what is not |
| [24-backup-recovery.md](24-backup-recovery.md) | Backups and recovery limits |
| [25-known-issues-debt.md](25-known-issues-debt.md) | Known issues and technical debt |
| [26-lovable-to-codex.md](26-lovable-to-codex.md) | Lovable dependencies and takeover answer |
| [27-service-inventory.md](27-service-inventory.md) | Third-party services |
| [28-critical-workflows.md](28-critical-workflows.md) | Eight end-to-end flows |
| [29-production-configuration.md](29-production-configuration.md) | Live non-secret configuration |
| [30-data-volumes.md](30-data-volumes.md) | Record counts and hot queries |
| [31-types-and-conventions.md](31-types-and-conventions.md) | Generated types and conventions |
| [32-privacy.md](32-privacy.md) | Sensitive data locations and controls |
| [33-codex-takeover-checklist.md](33-codex-takeover-checklist.md) | First session, trial changes, non-handovers |
| [34-system-capability-summary.md](34-system-capability-summary.md) | Plain-English summary of everything the system does |

## Rules this handover follows

- No secret values, tokens, passwords, client data or private correspondence appear anywhere in this folder — only variable names.
- Nothing described here was "improved" while documenting it. Problems are recorded in [25-known-issues-debt.md](25-known-issues-debt.md), not fixed.
- Phase 7 and MCP expansion are explicitly **not** started. See [19-mcp-current-state.md](19-mcp-current-state.md).
