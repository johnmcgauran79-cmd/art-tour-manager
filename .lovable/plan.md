
# WordPress Content Integration — Phase 1 Plan

Extend the existing ART Admin MCP (`src/lib/mcp/`) and Lovable Cloud/Supabase backend with a **read-only** WordPress content service for `australianracingtours.com.au`. Phase 2 (drafts, media upload, approval workflow) is **not** included and will be built only after you approve Phase 1.

## Architecture assessment

The existing MCP is a good fit — no need for a separate server:

- **Runtime**: `@lovable.dev/mcp-js` bundled into `supabase/functions/mcp/index.ts` by `mcpPlugin()` in `vite.config.ts`. Streamable HTTP, OAuth-verified via Supabase.
- **Tools**: one file per tool under `src/lib/mcp/tools/`, registered in `src/lib/mcp/index.ts`. Zod input schemas, `ToolContext` for identity.
- **Perms**: `_perms.ts::requireAdminOrManager` gates admin/manager-only tools via `has_role` RPC (RLS-scoped user token).
- **Audit**: `_audit.ts::auditReadCall` writes to `public.audit_log` via the user token — reused pattern.
- **Secrets**: Edge Function secrets read with `Deno.env.get` inside handlers (import-safe rule for the MCP entry).

Extending is clean: add tool files, register them, add secrets, add a UI page. No new MCP transport.

## Files to add

Server-side WordPress service (used only by MCP tool handlers, never bundled to browser):

- `src/lib/mcp/wordpress/_client.ts` — REST client. HTTPS Basic auth from `WORDPRESS_BASE_URL` / `WORDPRESS_USERNAME` / `WORDPRESS_APPLICATION_PASSWORD`. Fetch with 15s AbortController timeout, 2 retries on network/5xx only, no retry on 4xx. Endpoint allowlist (`tour`, `pages`, `media`, `categories`, `tags`, `tours`, and revision subpaths). Sanitised error surface — never logs Authorization header, credentials, or full response bodies containing secrets.
- `src/lib/mcp/wordpress/_analyzer.ts` — detects Gutenberg blocks, classic HTML, shortcodes, YOOtheme JSON comments (`<!-- wp:...` / `<!-- YOOtheme ...`), scripts, iframes, forms. Returns `editable_content_type` and `contains_yootheme_layout` flags. No mutation in Phase 1.
- `src/lib/mcp/wordpress/_audit.ts` — helper writing to new `wordpress_integration_audit_logs` table with correlation IDs.

MCP tools (all admin/manager gated via `requireAdminOrManager`, all readonly):

1. `src/lib/mcp/tools/wordpress-health-check.ts`
2. `src/lib/mcp/tools/wordpress-list-tours.ts`
3. `src/lib/mcp/tools/wordpress-get-tour.ts` (uses `context=edit`)
4. `src/lib/mcp/tools/wordpress-find-tour.ts`
5. `src/lib/mcp/tools/wordpress-list-pages.ts`
6. `src/lib/mcp/tools/wordpress-get-page.ts` (analyser output included)
7. `src/lib/mcp/tools/wordpress-get-media.ts`
8. `src/lib/mcp/tools/wordpress-search-media.ts`
9. `src/lib/mcp/tools/wordpress-get-taxonomies.ts`

Register all nine in `src/lib/mcp/index.ts` and extend the `instructions` string. Run `app_mcp_server--extract_mcp_manifest` and redeploy the `mcp` function.

UI (admin/manager only, `usePermissions`):

- `src/pages/WordpressContent.tsx` — Connection status card (Test Connection button → calls `wordpress_health_check` via `supabase.functions.invoke('wp-content-proxy', ...)`); read-only tour browser (search + list); tour detail drawer; audit log tail (from `wordpress_integration_audit_logs`).
- `src/components/wordpress/*` — small presentational components.
- Route added in `src/App.tsx`; sidebar link in `src/components/AppSidebar.tsx` under an admin-only section.
- The UI calls a **new thin Edge Function** `wp-content-proxy` (not MCP) so the browser can render live data without going through the MCP server. Same endpoint allowlist, same secrets, same audit logging, same role check via user JWT.

Edge Function:

- `supabase/functions/wp-content-proxy/index.ts` — verifies user JWT + admin/manager role, then delegates to a shared TS module (duplicated read from `src/lib/mcp/wordpress/_client.ts` logic via `supabase/functions/_shared/wordpressClient.ts` — Edge Functions cannot import from `src/`). Configured `verify_jwt = false` per project convention but validates the bearer manually.
- `supabase/functions/_shared/wordpressClient.ts` + `_shared/wordpressAnalyzer.ts` — Deno-flavoured copies of the two helpers (same logic, single source of truth is duplicated intentionally per existing pattern; both go through the same tests).

## Database changes (one migration)

Table `public.wordpress_integration_audit_logs` with the fields you specified: `id`, `created_at`, `user_id`, `source` (`mcp`/`ui`/`edge`), `action`, `wordpress_object_type`, `wordpress_object_id`, `request_summary jsonb`, `result_status`, `response_code`, `error_message`, `correlation_id`, `dry_run`, `before_snapshot jsonb`, `after_snapshot jsonb` (Phase 2 fields left nullable now).

GRANTs: `SELECT, INSERT` to `authenticated`; `ALL` to `service_role`. RLS enabled. Policies: `SELECT` to admin/manager only via `has_role`; `INSERT` where `user_id = auth.uid()` for logged-in users; edge function inserts via service role.

Never stores credentials, Authorization headers, or full response payloads — `request_summary` restricted to `{ endpoint, method, query_keys, status }`.

## Secrets

You will add three secrets (I'll open the secure form after you approve the plan — no password ever gets pasted here):

- `WORDPRESS_BASE_URL` → `https://australianracingtours.com.au`
- `WORDPRESS_USERNAME` → the dedicated content-integration WordPress user
- `WORDPRESS_APPLICATION_PASSWORD` → the Application Password generated in WordPress (Users → Profile → Application Passwords)

They land as Lovable Cloud / Supabase Edge Function Secrets, available to both the `mcp` and `wp-content-proxy` functions via `Deno.env.get`. Never exposed to the browser, never committed.

## Content safety (Phase 1 scope)

Analyser only — no mutation. Endpoint allowlist enforced in the shared client. No generic passthrough tool. `context=edit` used on authenticated reads so raw source is returned where WP permits.

## Testing

- `supabase/functions/wp-content-proxy/index.test.ts` and per-tool Deno tests under `supabase/functions/tests/wordpress/*` using mocked `fetch`. Cover: auth ok/fail, 401/403/404/5xx/timeout mapping, pagination, search, analyser detection, endpoint allowlist rejection, no-secrets-in-logs assertion, malformed JSON handling.
- Manual test plan: health check → list tours → fetch tour 7182 → fetch a standard page → fetch a YOOtheme page (verify `contains_yootheme_layout: true`) → search media → taxonomies → verify audit rows appear in `wordpress_integration_audit_logs`.

## Risks

- **YOOtheme pages** return HTML with layout JSON in comments — Phase 1 only reads and flags them; Phase 2 will refuse to touch them until we design a safe path.
- **Application Password stability** — LiteSpeed / security plugins sometimes strip the `Authorization` header. Health check surfaces that clearly.
- **REST enablement for `tour` CPT** — the CPT must have `show_in_rest: true`. Health check reports if `/wp-json/wp/v2/tour` returns 404 and recommends the fix.
- **Edge Function cold-start latency** on health check — acceptable, but retry logic is bounded.
- **Duplication of client code** between `src/lib/mcp/wordpress/_client.ts` and `supabase/functions/_shared/wordpressClient.ts` — unavoidable given Edge Functions can't import from `src/`; kept in lockstep by shared tests.

## Deployment steps (after implementation)

1. Approve DB migration when prompted.
2. Enter the three WordPress secrets in the secure form I open.
3. `mcp` and `wp-content-proxy` Edge Functions auto-deploy.
4. Open **WordPress Content** in the sidebar → **Test Connection** → verify green.
5. Run manual test plan above.
6. Report back and I'll open Phase 2 planning.

## Rollback

- Remove sidebar link + route + page (UI vanishes).
- Delete the nine `wordpress-*.ts` tool files and their registrations, re-run manifest extract, redeploy `mcp`.
- `supabase functions delete wp-content-proxy`.
- Drop `wordpress_integration_audit_logs` in a follow-up migration.
- Delete the three secrets from Edge Function Secrets. No live WordPress content is touched at any point in Phase 1.

## Explicitly out of scope for Phase 1

Writes, drafts, publishing, deletion, media upload, media metadata edits, tour duplication, pending-changes approval workflow, themes, plugins, users, roles, menus, settings, YOOtheme layout mutation, arbitrary endpoint access.
