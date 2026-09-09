# 26 — Lovable-specific dependencies and takeover assessment

## What Lovable currently provides

| Function | Lovable's role | Replaceable? |
| --- | --- | --- |
| Frontend hosting | Serves the SPA at `art-tour-manager.lovable.app` and the custom domain `admin.australianracingtours.com.au` | Yes — it is a static Vite build; any static host works, but DNS and the domain must be moved deliberately |
| Preview environments | Preview URL per project state | Yes — replace with any preview build |
| Publish action | One-click deploy of the frontend | Yes — replace with a build/deploy pipeline |
| GitHub sync | Two-way sync of the repository | The repository is ordinary Git; disconnecting simply stops the sync |
| Supabase management | Convenience wrapper over the user's own Supabase project | Not required — the Supabase project is ART's own (`upqvgtuxfzsrwjahklij`) and reachable directly |
| Migration tooling | Wrote the files in `supabase/migrations/` | Yes — the Supabase CLI applies the same files |
| Generated types | `src/integrations/supabase/types.ts` | Yes — `supabase gen types typescript` |
| AI Gateway | `LOVABLE_API_KEY` used by AI features | Only if `LOVABLE_API_KEY` remains valid; otherwise the AI features need `OPENAI_API_KEY` or another provider |

## Hard dependencies

- `LOVABLE_API_KEY` for AI features (`art-ai-chat`, AI-assisted flows). If Lovable access ends, these features stop unless repointed to another provider.
- `@lovable.dev/mcp-js` is a dependency in `package.json` used by the MCP surface.
- `lovable-tagger` (dev-only, in `vite.config.ts`) is harmless outside Lovable.
- The published domains are Lovable-hosted; moving them is a DNS operation with downtime risk.

## What is *not* dependent on Lovable

Everything that matters operationally: the Supabase database, all 88 edge functions, all cron jobs, all integrations (Resend, Microsoft Graph, Xero, WordPress, Meta, Teams), all business logic in Postgres functions, and the entire repository.

## Takeover assessment

Codex can take over development immediately without changing hosting. The repository is a conventional Vite + Supabase project; the Supabase CLI and dashboard give full control of database and functions.

**Do not disconnect Lovable, change hosting, or migrate anything as part of this handover.** That is a separate, explicitly-approved project. If it is ever undertaken, the sequence would be: reproduce the build and deploy pipeline elsewhere → verify the preview → move DNS → resolve `LOVABLE_API_KEY` for AI features → only then disconnect.
