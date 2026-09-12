# 34 — What the system does (plain-English capability summary)

A single functional overview of ART Admin as it stands in September 2026. Written for briefing people (or an AI assistant) on what the system can do, without needing to read the technical chapters. Every area below is live unless marked otherwise.

---

## 1. Tours

- Create, edit, duplicate and archive tours; duplication shifts dates forward a year and clears notes/statuses.
- Departure dates, provisional "Dates Not Confirmed" toggle, capacity, sold-out state, cancelled state (cascades to bookings and auto-archives after 7 days).
- Itinerary builder: days, entries, reordering, day photos (max 3 per day), snapshot PDF into Guest Docs.
- Inclusions and exclusions, editable and syncable with the website.
- Hotels: inventory, contracts/attachments, per-booking allocation, date cascade when tour dates change, oversold alerts.
- Activities: dress codes, internal terms, attachments, passenger allocation and discrepancy detection.
- Pickup locations and customer pickup selection.
- Additional Info blocks, guest documents, operations documents, external links.
- Tour Readiness checks, Reviews and Checks section, and relaxed supplier checks for DMC-managed tours.
- Host assignment, host briefing emails, and a view-only Hosts Info dashboard.
- Custom forms per tour with response tracking and CSV/PDF export.
- Tour alerts: oversold, cancellations, unread email, refreshed weekly.

## 2. Bookings

- Four-step booking wizard capturing core, medical and dietary details, up to three named passengers linked to contact records.
- Statuses progress Waitlist → Invoiced → Deposited → Instalment Paid → Fully Paid, plus Complimentary (treated as paid, skips invoicing) and Cancelled/Restored.
- Waitlisted bookings do not consume capacity.
- Room and bedding combinations, non-default check-in/out and extra nights (highlighted on rooming lists).
- Passport details tracking, travel documents, waivers, comments, audit log.
- Payment schedules, instalment details, outstanding amounts, payment alerts.
- Bulk operations and booking-change tracking.

## 3. Contacts (customers)

- Fast server-side search across name combinations and emails.
- Full profile: addresses, phones (Australian/NZ aware formatting), state, emergency contacts, avatars, tags, internal staff-only notes.
- Latest completed tour recorded automatically.
- Booking history, correspondence, campaign history, enquiry history on one record.
- Deduplication and merge tools, bulk delete (blocked where active bookings exist).
- Contact matching never overwrites an existing name.

## 4. Leads and CRM (Phases 1–6)

- Enquiries/leads separate from contacts, with owner, source, stage and tour interests.
- Configurable lead stages, first-response target (4 business hours), owner warning at 2 days, manager escalation at 5 days.
- Stage-specific "going cold" thresholds; Long-Term Nurture with review dates that are never nagged.
- Lead inbox, CRM dashboard, needs-attention cards, outcome dialogs.
- Automation rules with previews, cooldowns, idempotency and run logs.
- Conversion reporting: booked vs eligible enquiries, passenger conversion tracked separately, booking value from real booking records, one booking credits one enquiry.
- Full activity timeline per lead and contact.

## 5. Lead capture and forms

- Public forms at `/f/:slug`, embeddable on the website (Register Interest and Booking forms).
- Editable field sets, editable tour choice lists (future non-sold-out tours plus manually added prospects), editable room types.
- Every submission stored immutably exactly as submitted, with reprocess capability.
- Shared intake logic: match contact (email → mobile → name), create/reuse lead and tour interests, create a follow-up task by department, write timeline activity, capture consent only if ticked, send acknowledgement email, preserve attribution.
- External lead sources: generic keyed endpoint, Meta Lead Ads webhook, Zapier/partner feeds with idempotency and tour-wording mapping (currently disabled).

## 6. Marketing (ART's own system)

- Campaign/EDM builder with brand palettes, typography, custom cards and buttons, protected HTML blocks.
- Dynamic audiences resolved at send time: tour interest, enquiry status, lead source, tags, location, travel history, engagement, plus booking conditions (has/has no booking, booked or not booked on a tour, future booking, payment status, past traveller) and nurture conditions (in nurture, nurture tour, review date windows).
- Marketing eligibility gate: consent, unsubscribes, bounces and suppressions always win.
- Sequential sending via Resend with rate-limit pacing, scheduled sends processed every 5 minutes, pre-send review, timezone-aware scheduling.
- Tracking: open pixel, rewritten links, ART UTM parameters, click classification ("what a click means") and high-intent detection.
- Results reporting: sends, delivered, opened, clicked, meaningful clicks, unique contacts vs events, retry of failed recipients only.
- Attribution chain: tracked click → form submission → enquiry → booking → booking value. Receiving an email is never attribution.
- Tour-level marketing intelligence: audience size, interested but not booked, active and nurture leads, campaign activity, meaningful clicks per tour, enquiries and bookings attributed, and a funnel from eligible audience through to booked passengers. Engagement data only exists from Phase 6 onward and is labelled as such.
- Preference/unsubscribe pages; `news.` sending subdomain has no inbox, so replies route to bookings@.

## 7. Communications hub

- Microsoft 365 / Outlook integration via Graph: nine enabled shared mailboxes, delta sync every 15 minutes, 12 months of history imported (~12,700 emails stored).
- Incoming and outgoing mail matched automatically to contacts, leads and bookings; threaded and visible on the Contact, gated by per-user mailbox access.
- Send and reply from inside the system, with attachments.
- Transactional email library: booking confirmations, welcome emails, itineraries, travel document requests, passport requests, waivers, pickup requests, custom forms, rooming lists, passenger and activity lists, payment receipts.
- Email templates with Mustache logic, merge fields, dynamic passenger variables, branded headers, tour-specific overrides, live server-rendered previews.
- Rule-based and event-based automation with approval queues and manual override.
- Emails Sent page, delivery/bounce/complaint handling via Resend webhook, suppression list with manual reactivation.
- Scheduled and automated report distribution.
- Customer self-service links (profile, travel docs, waiver, pickup, forms, itinerary) expiring in 7 days; guest document links 28 days.
- Teams notifications for tour status changes, website changes, approvals and tasks, plus in-app notifications.

## 8. Task manager

- One task = one record across all views. Tasks link to tours, bookings, contacts, leads and activities.
- Statuses, priorities, departments, assignment (strictly by department), watchers, approvers, dependencies, subtasks, comments with attachments, templates.
- Automatically generated tour operation tasks and lead follow-up tasks.
- Due-date alerts and digests every 15 minutes; due dates stored as plain dates to avoid timezone drift.

## 9. Personal workspace

Per-user To-Do lists, notes with mentions, and a calendar showing tasks, tours and shared staff leave.

## 10. Reports and operations

- Rooming list, passenger list, passport details, dietary, activity matrix, activity discrepancies, booking changes, payment status, sent emails, missing phone numbers, bedding review, hotel allocations, host reports.
- Multi-passenger aware (passengers 1–3), exportable to CSV and PDF.
- Dashboard widgets: missing information across tours, payment alerts, upcoming emails, alerts, data health and integration status.

## 11. Finance (Xero)

- OAuth connection, contact and phone sync, state sync, incremental syncing with rate-limit handling.
- Draft invoice auto-generation from templates and fixed rows, split per-passenger invoices, invoice references and mapping.
- Daily payment receipt sync, payment status upgrades based on real payment totals, payment exception reporting and ART-vs-Xero comparison.

## 12. Website (WordPress)

Read and write integration with the public site: find/get tours and pages, media search and upload, preview diffs before publishing, push itinerary, inclusions and allowlisted tour fields, pull inclusions and day photos, full audit log of every change, and Teams notification on publish.

## 13. AI surfaces

- ART AI assistant (`/art-ai`) with deterministic skills for common questions (next departing tour, payment exceptions) and standardised date grounding.
- MCP server `art-tour-manager-wordpress-mcp` v2.6.0 with 117 tools covering tours, bookings, contacts, hotels, activities, tasks, finance, email and WordPress. Role-based access enforced; destructive tools require confirmation. Not expanded as part of the handover.

## 14. Administration

- Users created by admins only (no public sign-up), default role booking agent.
- Roles: admin, manager, booking agent (view-only), host (view-only, assigned tours). Permissions centralised.
- Settings: sender identity, timezone, loyalty, offsets, integrations, email rules, templates, task statuses, brands and theme, mailbox access, form settings, lead integration keys.
- Audit logging, backup reporting, data purges (AI conversations, passport data).

---

## Where this sits in the handover

- Technical detail for each area: chapters [03](03-modules-routes.md), [11](11-edge-functions-jobs.md), [12](12-crm.md)–[22](22-task-manager.md).
- Live configuration values: [29-production-configuration.md](29-production-configuration.md).
- Volumes: [30-data-volumes.md](30-data-volumes.md).
- Honest gaps: [23-testing-observability.md](23-testing-observability.md) and [25-known-issues-debt.md](25-known-issues-debt.md).
