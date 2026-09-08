# ART Admin — Technical Handover Documentation Package

Documentation only. No production behaviour, schema, functions, integrations, MCP or credentials change. Nothing gets fixed, refactored or upgraded as part of this work.

## What gets created

A new `docs/handover/` folder with `README.md` as the index, plus these files:

- `01-architecture.md` — purpose, stack, frontend/backend, Supabase, hosting, Mermaid architecture diagram
- `02-repository-map.md` — directories, entry points, routes, hooks, shared libraries, generated vs hand-written files
- `03-modules-routes.md` — every live module: path, purpose, who uses it, components, tables, permissions, integrations
- `04-database.md` — key tables, keys, relationships, triggers, derived vs authoritative fields, Mermaid ER diagram (no real personal data)
- `05-migrations.md` — where migrations live (416 files), how they apply, any drift between repository and live database (flagged, not repaired)
- `06-security-rls.md` — auth, roles, `user_roles` + `has_role`, real database enforcement vs interface hiding, service-role paths
- `07-env-secrets.md` — inventory of secret and variable NAMES only, with purpose and where configured
- `08-local-development.md` — clone, install, run, build, typecheck commands
- `09-deployment.md` — hosting, branches, deploy triggers, edge function and migration deployment, rollback, domains
- `10-codex-workflow.md` — safe branch → review → preview → merge → deploy → verify → rollback loop
- `11-edge-functions-jobs.md` — all 89 edge functions plus scheduled jobs: purpose, caller, auth, tables, secrets, schedule
- `12-crm.md` — Phases 1–6 as actually built, with real tables, functions, routes, components
- `13-crm-business-rules.md` — configured vs hard-coded rules (matching, first response, going cold, nurture, conversion, attribution, cooldowns)
- `14-email-marketing.md` — ART's own internal campaign system (explicitly not Brevo): audiences, eligibility, consent, tracking, click meaning, results, tour marketing intelligence, attribution
- `15-microsoft-email.md` — Graph app model, mailboxes, 15-minute sync, historical import, matching, threading, restrictions
- `16-forms-lead-intake.md` — public forms, immutable submissions, matching, lead reuse, tasks, consent, acknowledgements, retries
- `17-external-lead-integrations.md` — generic endpoint, keys, idempotency, Meta/Zapier/partners, tour wording mapping
- `18-wordpress.md` — read/write architecture, field allowlist, audit, limits
- `19-mcp-current-state.md` — current version, full tool inventory, auth, clients; marked PHASE 7 / MCP EXPANSION DEFERRED
- `20-teams-notifications.md` — Teams posting plus in-app notifications
- `21-tours-bookings.md` — tours, departures, capacity, booking and payment statuses, cancelled/archived/sold-out logic
- `22-task-manager.md` — model, relationships, lead tasks, automation-created tasks; states plainly ONE TASK = ONE RECORD across views
- `23-testing-observability.md` — what checks genuinely exist, honest gaps, logs, failure visibility
- `24-backup-recovery.md` — actual backup workflow and recovery limits; says so where no formal procedure exists
- `25-known-issues-debt.md` — issue, impact, severity, workaround, suggested future fix
- `26-lovable-to-codex.md` — every Lovable-specific dependency and a direct answer on whether development can move fully to GitHub/Codex
- `27-service-inventory.md` — table of every third-party service, auth type, variable names, failure impact
- `28-critical-workflows.md` — the eight end-to-end flows (website lead, external lead, client email, marketing, booking conversion, automation, WordPress update, task) with Mermaid diagrams
- `29-production-configuration.md` — non-secret live settings: stages, thresholds, nurture settings, enabled automation rules, click classifications, mailbox names/status, sync frequencies
- `30-data-volumes.md` — approximate record counts and performance-sensitive queries
- `31-types-and-conventions.md` — generated database types, regeneration, and the coding, date/timezone and naming conventions actually present
- `32-privacy.md` — where sensitive client and staff data lives and the controls on it (no personal data reproduced)
- `33-codex-takeover-checklist.md` — first-session checklist, 2–3 suggested low-risk trial changes (not implemented), and what must never go into GitHub

## How the content is produced

Everything is written from the actual repository and live database: route files, hooks, edge function sources, `supabase/config.toml`, migration folder, database schema, view/function definitions, role policies, CRM settings rows, click classification rows, mailbox records and approximate row counts. Anything that cannot be confirmed is marked as uncertain rather than guessed.

## Validation

After writing, the docs are checked back against code and database: route paths, table and function names, edge function names and schedules, commands, variable names, MCP tool count. A final summary reports documentation created, architecture/build/deployment/database status, integrations covered, MCP version and tool count, known debt, Lovable dependencies, whether Codex can take over, blockers needing ART action, and the recommended first validation step.

## Explicitly out of scope

No Phase 7, no MCP additions, no production changes, Lovable stays connected, no hosting or service moves, no credential rotation, no trial change performed. Work stops after the summary.
