# 32 — Sensitive data and privacy

No personal data, correspondence, credentials or client records appear in this documentation. This chapter records **where** sensitive data lives and how it is controlled.

## Categories of sensitive data held

| Category | Where | Notes |
| --- | --- | --- |
| Contact identity and address | `customers` | 6,637 people |
| Passport details | `bookings` / passport fields and `booking_travel_docs` | Highest sensitivity. `purge_passport_data` exists to remove it after travel; whether it is scheduled is `UNVERIFIED` |
| Medical and dietary information | `bookings`, customer profile | Health-adjacent; treat as sensitive |
| Emergency contacts | `customers` | |
| Private correspondence | `crm_emails`, `crm_email_contacts`, attachments | 12,771 messages including individual staff mailboxes |
| Marketing consent and unsubscribe state | `customers.marketing_consent`, `marketing_preferences`, `email_suppressions` | Legal basis for sending |
| Financial data | `bookings`, `xero_invoice_mappings`, `xero_payment_receipts` | No card data is stored anywhere in ART |
| Staff internal notes | contact internal notes, `personal_notes` | Never shown to customers |
| Uploaded documents and photos | Storage buckets: attachments, avatars, documents | Private buckets, signed URLs only |

## Controls in place

- Every one of the 145 public tables has RLS enabled, with 405 policies.
- Roles are held in `user_roles` and checked by the security-definer `has_role`; agents and hosts are view-only. Hosts see only tours assigned to them (`is_host_for_tour`).
- Mailbox correspondence is gated per-user by `email_mailbox_access` (`can_read_mailbox`, `can_read_crm_email`) — staff do not see colleagues' individual mailboxes by default.
- Customer self-service uses single-purpose tokens expiring in 168 hours; guest document links are signed for 28 days. No customer login exists.
- Storage buckets are private; files are served via short-lived signed URLs, never public paths.
- Sensitive operations are recorded in `audit_log` via `log_sensitive_operation`; booking, hotel, activity and task changes have their own change logs.
- AI conversations are purged on a retention schedule (`purge_ai_conversations`, daily 03:15 UTC, window from `ai_retention_days`).
- No card data is handled; payment is via Xero invoices.

## Obligations and cautions for whoever takes over

- Treat individual mailbox content as private correspondence. Grant `email_mailbox_access` narrowly and never widen it for convenience.
- Never paste real contact records, passport data, medical notes or email bodies into commits, issues, documentation, chat logs or test fixtures.
- Never write secrets or keys into database tables or the repository — Supabase secrets only.
- Passport retention should be confirmed and, if manual, made automatic; that is a recommendation, not something changed here.
- If ART receives a deletion or access request, the relevant records span `customers`, `bookings`, `crm_emails`, `landing_page_submissions`, `email_logs` and storage — there is no single "delete this person" routine today.
