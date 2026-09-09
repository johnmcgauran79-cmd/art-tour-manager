# 05 — Migrations and schema history

## Where migrations live

`supabase/migrations/` holds **416** timestamped SQL files. They are the full history of the schema from first build to now, including CRM Phases 1–6.

These files are written by the migration tooling. Treat them as append-only history:

- Never edit an existing migration file. It has already run against production.
- Never hand-copy or reorder files.
- A schema change is a **new** migration file, applied forward.

## How a change is applied

1. A new migration is authored (`CREATE TABLE`, `ALTER`, function/trigger/policy changes).
2. It runs against the live Supabase project.
3. `src/integrations/supabase/types.ts` is regenerated from the resulting schema. Types are always downstream of the database, never the other way round.

Required order for any new public table, without exception:

```sql
CREATE TABLE public.example (...);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.example TO authenticated;
GRANT ALL ON public.example TO service_role;
-- GRANT SELECT ON public.example TO anon;  -- only if a policy allows anonymous reads
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;
```

Grants are not optional. Postgrest returns a permission error for any public table without them, regardless of RLS.

## Conventions observed in the existing migrations

- Validation is done with triggers, not `CHECK` constraints, so time-based rules (`expires_at > now()`) do not break restores.
- Role checks inside policies always go through the `SECURITY DEFINER` function `has_role()` to avoid recursive RLS on `user_roles`.
- Reserved schemas (`auth`, `storage`, `realtime`, `vault`, `supabase_functions`) are never modified and carry no ART triggers.
- Reporting logic is added as views or `SECURITY DEFINER` functions rather than materialised copies of data.

## Drift between repository and live database

A file-by-file replay comparison was **not** performed for this handover, so exact drift is `UNVERIFIED`. What was verified live:

- 145 public tables, all with RLS enabled, 405 policies.
- 9 public views present, including all Phase 6 additions (`crm_contact_booking_facts`, `crm_contact_nurture_facts`, `crm_campaign_attribution`, `crm_lead_marketing_signals`, `campaign_event_intent`, `marketing_contact_eligibility`, `crm_contact_marketing_facts`, `crm_lead_facts`, `crm_lead_activity_facts`).
- All 19 `crm_*` functions listed in [04-database.md](04-database.md) exist live.

There is one known naming inconsistency worth flagging rather than repairing: `crm_settings` uses a single-row settings table with typed columns (`first_response_target_hours`, `first_response_basis`, `owner_warning_days`, `manager_escalation_days`, `crm_era_start`) and an `id` column of type boolean, whereas `general_settings` uses a different shape. Any Codex work touching settings should read the live columns first rather than assuming a key/value table.

Recommended first step for a new maintainer: dump the live schema and diff it against a clean replay of `supabase/migrations/` in a scratch project. **Record the differences; do not "fix" production to match the files.** Existing production data and Phase 1–6 behaviour take precedence.
