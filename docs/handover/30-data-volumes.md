# 30 — Data volumes and performance-sensitive areas

Live counts, 8 September 2026 (read-only query). Approximate and growing.

| Table | Rows |
| --- | --- |
| `customers` | 6,637 |
| `crm_emails` | 12,771 |
| `tasks` | 999 |
| `bookings` | 743 |
| `email_logs` | 1,906 |
| `campaign_recipients` | 344 |
| `tours` | 64 |
| `wordpress_tour_links` | 32 |
| `email_mailboxes` | 10 |
| `marketing_audiences` | 5 |
| `lead_integrations` | 2 |
| `marketing_campaigns` | 1 |
| `landing_pages` | 1 |
| `leads`, `tour_interests`, `crm_activities`, `landing_page_submissions`, `campaign_events`, `crm_automation_rules`, `marketing_automation_rules`, `marketing_link_classifications` | 0 |

Schema scale: 145 public tables (all RLS-enabled), 405 policies, 9 public views, 416 migration files.

## Where performance actually bites

| Area | Why | Mitigation already in place |
| --- | --- | --- |
| Contact search across 6,637 contacts | Multi-field name/email matching | 250 ms debounce, server-side search (`secure_customer_search`) |
| Any global booking or passenger listing | Cross-tour scans cause N+1 patterns and egress cost | **Prefer tour-scoped fetches** (`useTourBookings`) over global table scans. This is a standing rule |
| Supabase 1,000-row default limit | Silently truncates large result sets | Check for this before diagnosing "missing data" |
| Bulk email sends | Resend ~2/sec | Sequential sends with ~600 ms spacing; large campaigns legitimately take minutes |
| Xero sync | API rate limits | 300 ms spacing, 429 retries, `xero_api_locks` |
| Microsoft history import | Graph throttling on wide ranges | Imports one month at a time, working backwards |
| `crm_emails` growth | 12,771 rows and rising every 15 minutes | Mailbox-scoped and contact-scoped queries only |
| Reports and PDFs | Client-side generation for downloads | react-pdf client-side, `print()` for reports, html2pdf for email attachments; no Puppeteer in edge functions |
| Marketing audience evaluation | Rule tree evaluated at send time across all contacts | Fact views (`crm_contact_booking_facts`, `crm_contact_nurture_facts`, `marketing_contact_eligibility`) do the heavy lifting in Postgres |

## Growth to watch

`crm_emails` is the fastest-growing table and the most likely to need index or retention attention first. `campaign_events` will grow quickly once tracked campaigns are sent regularly. Neither has a retention policy today beyond AI conversation purging and passport purging.

No performance baseline has been recorded over time — there is no APM. Supabase's slow-query view is available on demand.
