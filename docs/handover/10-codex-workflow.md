# 10 — Safe change workflow

A repeatable loop for making changes to a live business system with real client data.

## The loop

1. **Understand before touching.** Read the relevant hook in `src/hooks/`, the component, and any Postgres function or view involved. Business rules usually live in the database, not the component.
2. **Branch.** One branch per change, scoped narrowly. Do not bundle a refactor with a fix.
3. **Check the blast radius.**
   - Does the file live in `supabase/functions/_shared/`? Several endpoints will change at once.
   - Is the function called by cron as well as the interface?
   - Does the change touch sending, payment status, or attribution? Those are the highest-risk areas.
4. **Change the smallest thing that works.** No opportunistic renames, dependency bumps or "while I'm here" cleanups.
5. **Verify locally.** `npm run lint` and `npx tsc --noEmit` must both be clean. Load the affected screen in the dev server.
6. **Preview.** Exercise the actual workflow end to end on the preview URL, logged in as a role that matters (admin and, where relevant, agent or host).
7. **Read the logs.** Supabase edge function logs for any function involved; browser console for the screen.
8. **Merge and publish.**
9. **Verify in production** on the real domain, with a real (harmless) record.
10. **Have the rollback ready** before publishing: republish previous frontend, revert the function, or a reversing forward migration.

## Rules that are not negotiable

- Never edit `supabase/migrations/*.sql` retrospectively; add a new migration.
- Never edit `src/integrations/supabase/types.ts` by hand.
- Every new public table gets `GRANT`s in the same migration, then RLS, then policies.
- Never weaken a token check, role check or webhook signature check.
- Never send test email to a real client address; use an internal address.
- Never store credentials in database tables or in the repository.
- Deletions of tours or bookings go through the cascade functions, never raw `DELETE`.

## Highest-risk changes — treat with extra care

| Area | Why |
| --- | --- |
| `marketing-send-campaign`, `process-scheduled-campaigns` | Can send thousands of real emails; Resend rate limits apply |
| Payment status logic and Xero sync | Drives what ART believes clients owe |
| Attribution (`crm_booking_converts_lead`, `crm_campaign_attribution`) | Changing it rewrites reported performance |
| RLS policies and `has_role` | A mistake exposes client data |
| Token validation functions | A mistake exposes another customer's record |
| Cascade delete functions | Irreversible data loss |

## Good first changes

See [33-codex-takeover-checklist.md](33-codex-takeover-checklist.md) for suggested low-risk starting changes. They are suggestions only and have deliberately **not** been implemented as part of this handover.
