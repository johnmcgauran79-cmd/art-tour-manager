# 31 — Generated types and coding conventions

## Generated files — never hand-edit

| File | Source |
| --- | --- |
| `src/integrations/supabase/types.ts` | Generated from live database schema |
| `src/integrations/supabase/client.ts` | Generated client with project URL and publishable key |
| `supabase/migrations/*.sql` | Written by the migration tooling; add new files, never edit applied ones |

Regenerate types with `supabase gen types typescript --project-id upqvgtuxfzsrwjahklij > src/integrations/supabase/types.ts` after any schema change. Newer RPCs are sometimes called with an `as any` cast where types lag behind — that is a deliberate stopgap, not an error.

## Frontend conventions

- **Data access lives in hooks.** One hook file per domain in `src/hooks/`; components do not call Supabase directly.
- TanStack Query for all server state; React Hook Form + Zod for forms.
- shadcn/ui components in `src/components/ui/` — treat as vendored primitives.
- **Semantic design tokens only.** Colours, gradients and shadows come from `src/index.css` variables and component variants. Never hard-code `text-white`, `bg-black` or hex utilities — the dynamic theme engine injects brand colours at runtime (`useThemeProvider`, `useBrandPalette`).
- Typography: Larken headings (never uppercase, rarely bold), Poppins body, applied through `src/lib/typography.ts` and `src/lib/brandFonts.ts`.
- Permissions always through `usePermissions`; deny shows `PermissionErrorDialog`.
- Nested dialogs close sequentially with a 150 ms delay and a pointer-events reset, or the interface freezes.

## Backend conventions

- Edge functions import from `https://esm.sh/...`, never `npm:` — `npm:` specifiers cause Supabase codegen/bundling timeouts.
- Shared logic goes in `supabase/functions/_shared/`.
- Business rules that must not be bypassed live in Postgres (triggers, security-definer functions), not only in the frontend.
- Roles live in `user_roles` and are checked via the security-definer `has_role`. Never store a role on a profile or user row.
- Every new public table: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies, in that order, in one migration.
- Validation that depends on `now()` uses triggers, not CHECK constraints.
- No PDF generation with Puppeteer or filesystem access inside edge functions.

## Dates and timezones — read this before touching any date

- **Display is always Australian: dd/mm/yyyy.** Never US format, anywhere — app, emails, documents, reports.
- **Task due dates are stored as literal `yyyy-MM-dd` strings**, not ISO timestamps, specifically to avoid timezone shifting a due date by a day.
- Tour and itinerary day generation is UTC-safe by design; itinerary day maths must not drift.
- MCP and API date parameters use `YYYY-MM-DD`.
- **All cron schedules are UTC**, while the business operates in Australian time. A job at 20:00 UTC runs the next Australian morning.
- Date grounding for the assistant is centralised in `supabase/functions/_shared/artAiDates.ts` — do not reimplement "today" logic elsewhere.

## Naming

`snake_case` in the database, `camelCase` in TypeScript, `use*` for hooks, `PascalCase.tsx` for components, kebab-case directories for edge functions matching their invoked name.

## Terminology (use these exact words in the interface)

"Passport Details", "Booking Notes & Requests", "Public Transport". A **Contact** is a person; an **Enquiry** is an interest in travelling.
