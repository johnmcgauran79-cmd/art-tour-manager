# 06 — Security, auth and RLS

## Staff authentication

Supabase Auth with email and password. There is **no public registration** — an admin creates each user, who receives a temporary password and is prompted to change it (`generate_temp_password`, `AddUserModal`, `PasswordChangeModal`, `AdminPasswordResetModal`). `handle_new_user` creates a `profiles` row and `handle_new_user_role` assigns the default `booking_agent` role.

## Roles

Roles live in their own table, `user_roles`, keyed by `user_id` with the `app_role` enum: `admin`, `manager`, `booking_agent`, `agent`, `host`. Roles are never stored on `profiles` or `customers`.

Live distribution: 1 admin, 5 managers, 1 agent, 8 hosts.

All policy role checks go through:

```sql
public.has_role(_user_id uuid, _role app_role) returns boolean
  language sql stable security definer set search_path = public
```

`SECURITY DEFINER` is what stops recursive RLS when a policy on any table needs to read `user_roles`.

Supporting helpers: `check_user_role`, `is_crm_staff`, `is_host_for_tour`, `agent_assigned_to_booking`, `can_read_mailbox`, `can_read_crm_email`, `can_manage_mailboxes`, `can_write_attachments`, `is_website_approver`, `is_note_owner` / `is_note_shared_with`, `is_todo_owner` / `is_todo_shared_with`, `is_task_watcher`.

## Two layers, both real

| Layer | Mechanism | What it does |
| --- | --- | --- |
| Interface | `usePermissions` hook | Hides or blocks actions, shows `PermissionErrorDialog` on denial |
| Database | 405 RLS policies + `has_role()` | Enforces the same boundaries even if the interface is bypassed |

Every one of the 145 public tables has RLS enabled — verified live. Interface hiding is convenience; the database is the boundary.

Notable database-level restrictions:

- Hosts read only data for tours they are assigned to (`is_host_for_tour`).
- Agents are effectively view-only, with booking access scoped by `agent_assigned_to_booking`.
- Microsoft mailbox content is gated by `email_mailbox_access` through `can_read_mailbox` / `can_read_crm_email` — a staff member does not see another person's mailbox unless granted.
- Personal notes/todos are owner-scoped with explicit share tables.
- `secure_customer_search` exists so contact search does not require broad table reads.

## Storage

Attachment and avatar buckets are private. Files are always reached through short-lived signed URLs (`useSignedUrl`, `get_attachment_download_url` in MCP, `email-file`). Guest document signed URLs last 28 days; customer access tokens 168 hours.

## Edge function authentication — read this carefully

Almost every entry in `supabase/config.toml` sets `verify_jwt = false`. This was deliberate: cron jobs, webhooks and public token pages all call functions without a user JWT, and platform JWT verification proved unreliable for those paths. The consequence is that **each function is responsible for authorising its own caller**. The patterns in use:

| Pattern | Used by |
| --- | --- |
| Supabase user token passed in and checked, plus a role check | staff-triggered functions (report generation, sends, syncs, `delete-user`, `reset-user-password`) |
| Opaque single-purpose customer token, validated against the database and expiry | `validate-*-token`, `submit-*`, `update-*` |
| Hashed integration key | `lead-intake` (external partner/Zapier feeds) |
| Provider webhook secret / signature | `resend-webhook` (`RESEND_WEBHOOK_SECRET`), `meta-leads-webhook` (`META_APP_SECRET`, `META_VERIFY_TOKEN`), `xero-webhook`, `backup-report` (`BACKUP_WEBHOOK_SECRET`) |
| OAuth (MCP) | `mcp` uses the Supabase Auth issuer for OAuth-based tool access |
| Cron only, no external caller expected | `process-*`, `refresh-tour-alerts`, `archive-completed-tours`, `purge-*` |

Functions run with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. The service role key is never exposed to the browser; the frontend only ever uses the publishable/anon key.

**This is the single most important area for a new maintainer to respect.** Any new function must implement its own caller check. Any change that weakens a token check, a role check or a webhook signature check is a production security regression.

## Audit trails

`audit_log`, `booking` change logging (`log_booking_changes`, `log_activity_booking_changes`, `log_hotel_booking_changes`), `task_activity_log`, `lead_stage_history`, `wordpress_integration_audit_logs`, `xero_sync_log`, `email_sync_runs`, `crm_automation_runs`, `marketing_automation_log`, and `log_sensitive_operation` for elevated actions.

## Retention

- Passport data is purged on a schedule (`purge_passport_data`, `purge-passport-data` function).
- AI conversations are purged nightly with a retention window (`ai_retention_days`, `purge-ai-conversations`).
