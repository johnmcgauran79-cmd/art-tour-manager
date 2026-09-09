# 29 — Live production configuration (non-secret)

Snapshot taken 8 September 2026 by read-only query. Configuration changes over time; the database is authoritative.

## CRM settings (`crm_settings`)

| Setting | Value |
| --- | --- |
| CRM era start | 2026-09-01 (performance reporting ignores earlier data) |
| First-response basis | `business` (working hours) |
| First-response target | 4 hours |
| Owner warning | 2 days |
| Manager escalation | 5 days |

Note: `crm_settings` uses typed columns, not a key/value shape.

## Lead stages (`crm_lead_stages`)

| Stage | Active | Requires next action | Stale after | Notes |
| --- | --- | --- | --- | --- |
| New | yes | yes | 1 day | |
| Attempting Contact | yes | yes | 2 days | |
| Contacted | yes | yes | 5 days | |
| Qualified | yes | yes | 7 days | |
| Considering | yes | yes | 14 days | |
| Booking in Progress | yes | yes | 5 days | |
| Booked | no | no | — | won; not open |
| Long-Term Nurture | no | no | — | open but exempt from chasing |
| Lost / Not Proceeding | no | no | — | lost; not open |

## Mailboxes (`email_mailboxes`)

Enabled and healthy, all with 12 months of history: `admin@`, `bookings@`, `info@` (shared); `belinda@`, `donna@`, `jane@`, `john@`, `monique@`, `tara@` (individual). Disabled: `news.tours@` — send-only marketing subdomain with no Microsoft mailbox. Leave disabled.

## Users and roles (`user_roles`)

1 admin, 5 managers, 1 agent, 8 hosts. Agents and hosts are view-only in their permitted areas. There is no public registration; admins create users.

## Marketing audiences (`marketing_audiences`)

Five active, all state-based, with last counts: South Australia 3,990; Victorians 344; NSW 257; Queensland 234; Western Australia 90.

## Click classifications (`marketing_link_classifications`)

**None configured.** Until rules exist, no click can be marked meaningful or tied to a tour.

## Automation

`crm_automation_rules` and `marketing_automation_rules` are both **empty** — automation is built but dormant.

## External lead integrations (`lead_integrations`)

Meta and Zapier rows exist; both **disabled**. Keys are stored hashed with a visible prefix only.

## Scheduled jobs

See [11-edge-functions-jobs.md](11-edge-functions-jobs.md). All schedules are UTC.

## Other operational rules configured in the app

- Customer access links expire in 168 hours; guest document signed URLs last 28 days.
- Dates display as dd/mm/yyyy throughout (Australian), including emails and documents.
- Task due dates are stored as literal `yyyy-MM-dd` strings.
- Marketing replies route to the bookings inbox because the `news.` subdomain has no inbox.
- Fonts: Larken for headings (never uppercase, rarely bold), Poppins for body — app, emails and documents.
- Email layout: fluid 100% width, 800px max width.
