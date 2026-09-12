# 27 — External service inventory

Variable **names** only; no values. See [07-env-secrets.md](07-env-secrets.md).

| Service | Used for | Auth (variable names) | If it fails |
| --- | --- | --- | --- |
| **Supabase** | Database, auth, storage, edge functions, cron | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Total outage — nothing works |
| **Resend** | All outbound email: transactional, automated, marketing; plus delivery/bounce webhooks | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MARKETING_FROM_NAME`, `MARKETING_FROM_EMAIL`, `MARKETING_REPLY_TO` | No email sends at all; suppression tracking stops. Very high impact |
| **Microsoft Graph** | Mailbox correspondence sync and Teams notifications | `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_REDIRECT_URI` | Correspondence history stops updating; Teams notifications stop. Existing stored emails remain |
| **Xero** | Invoices, contacts, payment receipts, phone/state sync | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Invoices cannot be created; payment status goes stale. High financial impact |
| **WordPress** | Public website content read/write | `WORDPRESS_BASE_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APPLICATION_PASSWORD` | Website publishing from ART stops; ART itself unaffected |
| **Meta / Facebook** | Lead ad intake webhook | `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Meta leads not received. Currently disabled anyway |
| **Lovable** | Hosting, publish, AI gateway | `LOVABLE_API_KEY` | AI features stop; hosted app keeps serving |
| **OpenAI** | Alternative/auxiliary AI | `OPENAI_API_KEY` | AI features degrade |
| **GitHub** | Repository and the backup workflow | Repo credentials, `BACKUP_WEBHOOK_SECRET` | Development and backup job affected, not the running app |

## Application URL variables

`APP_URL`, `PUBLIC_APP_URL`, `PUBLIC_SITE_URL`, `SITE_URL` — used to build customer-facing links in emails. If they are wrong, emails go out with broken links, which is a visible client-facing failure. Verify these first after any environment change.

## Rate limits to respect

- Resend: roughly 2 sends per second → bulk sends are sequential with ~600 ms spacing.
- Xero: 300 ms spacing plus 429 retry handling; `xero_api_locks` prevents overlapping syncs.
- Microsoft Graph: throttles on large history imports → history is imported one month at a time.
- WordPress: host-dependent; do bulk pushes in batches.
