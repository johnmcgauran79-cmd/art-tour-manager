# 08 — Local development

## Requirements

- Node 20+ (or Bun)
- Access to the Supabase project, or your own Supabase project for isolated work
- No Docker requirement — local Supabase is not part of the current workflow

## Setup

```bash
git clone <repository-url>
cd <repository>
npm install          # or: bun install
```

Create `.env` in the project root:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload (port 8080 in the managed environment) |
| `npm run build` | Production build |
| `npm run build:dev` | Build with development mode settings |
| `npm run preview` | Serve the built output |
| `npm run lint` | ESLint across the repo |
| `npx tsc --noEmit` | TypeScript check (there is no dedicated npm script) |

There is **no test script and no test suite.** See [23-testing-observability.md](23-testing-observability.md).

## Important caveat about running locally

The dev server talks to the **live** Supabase project unless you point `.env` at a different one. That means:

- Writes from your machine hit production data.
- Triggering a send, sync or campaign locally sends real email and touches real integrations.

For anything beyond reading screens, either use a separate Supabase project or work on the hosted preview. Never test sends against real client addresses.

## Edge functions

Functions are deployed to Supabase, not run as part of `npm run dev`. Locally the app calls the deployed functions. Deno is required only if you want to type-check or test function code directly; imports use `esm.sh` URLs rather than `npm:` specifiers, which matters if you add dependencies.

## Generated files

Do not hand-edit `src/integrations/supabase/types.ts` or `src/integrations/supabase/client.ts`; they are regenerated from the database and project configuration.
