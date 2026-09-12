# 07 — Environment variables and secrets (names only)

**No values appear here.** Every value lives either in the Supabase Edge Function secrets store or in the hosting environment. Nothing in this list should ever be committed to GitHub.

## Frontend (build-time, public by design)

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key used by the browser client |
| `VITE_SUPABASE_PROJECT_ID` | Project ref, used by tooling |

These are publishable. Security rests on RLS, not on hiding them. The values are also currently inlined in the generated `src/integrations/supabase/client.ts`.

## Edge function secrets

Platform-provided:

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | API URL inside functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated database access. Never send to the browser |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Used where a non-elevated client is wanted |

Email:

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Sending all transactional and marketing email |
| `RESEND_WEBHOOK_SECRET` | Verifies delivery/bounce/open webhooks |
| `MARKETING_FROM_NAME`, `MARKETING_FROM_EMAIL`, `MARKETING_REPLY_TO` | Marketing sender identity; replies route to the bookings inbox because the `news.` subdomain has no mailbox |

Microsoft:

| Name | Purpose |
| --- | --- |
| `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET` | Graph app credentials for mailbox sync, sending and Teams |
| `MS_GRAPH_REDIRECT_URI` | OAuth redirect for the Teams user connection flow |

Xero:

| Name | Purpose |
| --- | --- |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Xero OAuth app. Tokens/tenant are stored in `xero_integration_settings` |

WordPress:

| Name | Purpose |
| --- | --- |
| `WORDPRESS_BASE_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APPLICATION_PASSWORD` | REST API access to the public website |

Lead capture:

| Name | Purpose |
| --- | --- |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Facebook/Instagram lead-ads webhook |

AI:

| Name | Purpose |
| --- | --- |
| `LOVABLE_API_KEY` | Lovable AI Gateway, used by the in-app assistant |
| `OPENAI_API_KEY` | Present as an alternative/legacy path for AI calls |

Other:

| Name | Purpose |
| --- | --- |
| `BACKUP_WEBHOOK_SECRET` | Authenticates backup reporting into `backup_runs` |
| `APP_URL`, `PUBLIC_APP_URL`, `PUBLIC_SITE_URL`, `SITE_URL` | Base URLs used when building customer links and tracked URLs |

Note the four overlapping base-URL names. They are historical; see [25-known-issues-debt.md](25-known-issues-debt.md).

## Rules

1. Add or change a secret through the Supabase function secrets store, then redeploy affected functions.
2. Do not read secrets into database tables.
3. Do not log secret values; do not echo them in function output or error messages.
4. Credential rotation is **not** part of this handover and should be planned with ART deliberately, since Xero and Microsoft tokens will need reconnection.
