# 02 — Repository map

## Top level

| Path | What it is |
| --- | --- |
| `index.html` | SPA shell and head metadata |
| `src/` | The whole frontend |
| `supabase/functions/` | 88 edge functions plus `_shared/` |
| `supabase/migrations/` | 416 SQL migrations (managed by the migration tooling) |
| `supabase/config.toml` | Project ref and per-function `verify_jwt` settings |
| `docs/` | User and technical documentation, including this handover |
| `.lovable/plan/` | Archived approved build plans — useful history for "why is it like this" |
| `.github/workflows/db-backup.yml` | Scheduled database backup workflow |
| `tailwind.config.ts`, `src/index.css` | Design tokens, brand fonts, theme variables |
| `drizzle.config.ts` | Present for schema tooling only; the app does not use Drizzle at runtime |
| `ACCESSIBILITY.md`, `EMAIL_TRACKING_SETUP.md`, `TEST_EMAIL_INSTRUCTIONS.md` | Standalone notes |
| `tmp/*.eml` | Sample emails kept for reference; not used by the app |

## `src/`

| Path | What it is |
| --- | --- |
| `main.tsx` | React root |
| `App.tsx` | Router, providers, route guards |
| `pages/` | 38 route-level screens (Index dashboard, TourDetail, Leads, Marketing, Settings, Communications, operations/* reports, public token pages) |
| `components/` | Feature folders: `tours/`, `bookings/`, `contacts/`, `crm/`, `marketing/`, `email/`, `tasks/`, `hotels/`, `activities/`, `itinerary/`, `reports/`, `operations/`, `settings/`, `dashboard/`, `finance/`, `wordpress/`, `layout/`, `shared/`, `ui/` (shadcn primitives) |
| `hooks/` | ~180 data hooks, one per domain concern (`useTours`, `useTourBookings`, `useCrmSales`, `useTourMarketingIntelligence`, `usePermissions`, …). This is the data-access layer — screens rarely call Supabase directly |
| `lib/` | Pure logic: `edm/` (audience rules, palette, templates), `mcp/` (MCP tool implementations and WordPress mapping), `typography.ts`, `brandFonts.ts`, `statusColors.ts`, `cancellationPolicy.ts`, `mergeFields`-adjacent helpers |
| `utils/` | Formatting and processing helpers (`phoneFormatter`, `csvParser`, `mergeFields`, `inputSanitizer`, `bookingQueries`) |
| `integrations/supabase/` | **Generated** client and `types.ts` |
| `contexts/` | `AiContext` for the in-app assistant |

## Generated vs hand-written

**Generated — never hand-edit:**

- `src/integrations/supabase/types.ts` — database types, regenerated from the live schema.
- `src/integrations/supabase/client.ts` — client bootstrap (URL and publishable key).
- `supabase/migrations/*.sql` — written by the migration tooling; treat as an append-only history.
- `src/components/ui/*` — shadcn primitives; customise via tokens/variants rather than rewriting.

**Hand-written:** everything else, notably `src/hooks/`, `src/components/<feature>/`, `src/lib/`, and `supabase/functions/`.

## Conventions worth knowing before editing

- One hook per data concern; components consume hooks and never build ad-hoc queries in the render path.
- Colours come from CSS variables/design tokens (`src/index.css`, `tailwind.config.ts`), not hard-coded Tailwind colours — the theme engine and brand palettes depend on this.
- Fonts: Larken for headings (never uppercase, rarely bold), Poppins for body — in the app, emails and generated documents.
- Permissions are always read through `usePermissions`; agents are view-only and denials show `PermissionErrorDialog`.
- Shared edge-function logic lives in `supabase/functions/_shared/` (e.g. `leadIntake.ts`, `marketingTracking.ts`, `artAiDates.ts`) and is imported by several functions — changing it changes multiple endpoints.
