# In-house Marketing CRM (replacing Brevo)

Bring email marketing, register-interest landing pages and sales/lead management into ART, reusing the existing contacts, tours, tasks, brands and Resend infrastructure.

## Decisions locked in
- Separate marketing sending subdomain (e.g. `news.australianracingtours.com.au`) so marketing complaints never affect booking emails.
- Marketing and sales built together, delivered in phases.
- Leads live on the existing `customers` table with lead fields — one record per person.
- Simple automation now (on submit / on stage change → email, task, Teams). Multi-step journeys later.

## New sidebar section: Marketing

Four tabs:

1. **Campaigns** — list of EDMs with status (draft / scheduled / sending / sent), recipients, opens, clicks, bounces, unsubscribes.
2. **Audiences** — saved segments built from real ART data (state, latest tour, tour interest, lead stage, past pax of tour X, no booking in year Y, engaged/unengaged, excludes suppressed).
3. **Leads** — Kanban + table pipeline: New → Contacted → Qualified → Proposal → Won / Lost. Owner, source, tour of interest, next action. Tasks created straight into the existing task system.
4. **Landing pages** — register-interest forms per tour or general enquiry, with a public URL.

## EDM builder

- **Blocks mode (WYSIWYG)**: drag/reorder blocks — hero image, heading, rich text, image + text, button, tour card, divider, spacer, footer. Brand-aware colours and logo from the existing `brands` table.
- **HTML mode**: paste/edit raw HTML for imported designs, with a live preview and a merge-field inserter.
- Reuses the existing merge-field engine (`{{first_name}}`, `{{host_details}}`, tour fields) plus new marketing tokens `{{unsubscribe_url}}`, `{{preferences_url}}`, `{{view_in_browser_url}}`.
- Desktop/mobile preview and a "send test to me" button.
- Save any EDM as a reusable campaign template.

## Sending, compliance and deliverability

- Campaign send creates one queued recipient row per contact; a background worker sends at Resend's safe rate (~2/sec with retries) and reports live progress. A 6.5k send takes roughly an hour — the UI shows a progress bar.
- Hard rules enforced server-side: skip anyone in `email_suppressions`, skip contacts without marketing consent, one email per address per campaign.
- Every marketing email gets `List-Unsubscribe` + one-click headers, a visible unsubscribe link, and an Australian Spam Act sender block.
- **Preference centre** at a public URL: unsubscribe from marketing only, or choose interests — never blocks booking/transactional email.
- Opens, clicks, bounces, complaints tracked via the existing Resend webhook and rolled up per campaign and per contact.

## Landing pages / register interest

- Builder for a simple branded page: headline, image, body, fields (name, email, phone, state, tour of interest, message), consent checkbox with logged wording and timestamp, thank-you message.
- Public route `/i/:slug`, no login, honeypot + rate limiting against spam.
- On submit: match or create the contact, set lead stage New, record source and consent, fire the automation rules (welcome email, task for the owner, Teams notification), and show in Leads immediately.

## Automation (v1)

Rule builder: **When** [form submitted on page X | lead stage changes to Y | contact added to audience Z] → **Do** [send campaign/template, create task with assignee + due offset, notify Teams channel, set lead stage/owner]. Each firing is logged so nothing sends twice.

## Brevo wind-down

Brevo stays connected read-only during changeover. Once the first campaign has sent cleanly from the new system, we remove the Brevo sync buttons and the Keap→Brevo push, keeping the migration console's Keap collect/staging data for reference.

## Limitations to accept

- Deliverability reputation is ours to manage: new subdomain needs warming (start small, grow volume over ~2 weeks).
- No inbox-rendering previews or spam-score testing like Brevo/Litmus.
- No A/B testing, heatmaps or advanced deliverability analytics in v1.
- Rate-limited sending means big campaigns are gradual, not instant.
- Multi-step drip journeys are a later phase.

## Technical notes

- New tables: `marketing_campaigns`, `campaign_recipients`, `campaign_events`, `marketing_audiences`, `email_blocks_templates`, `landing_pages`, `landing_page_submissions`, `marketing_automation_rules`, `marketing_automation_log`; lead fields added to `customers` (`lead_stage`, `lead_source`, `lead_owner_id`, `interested_tour_id`, `marketing_consent`, `consent_at`, `consent_source`). All with GRANTs and RLS (staff-only, plus narrow anon insert for public form submissions via an edge function only).
- New edge functions: `marketing-send-campaign` (queue + worker), `marketing-submit-lead` (public, validated), `marketing-preferences` (public unsubscribe/preferences), extension of `resend-webhook` to attribute marketing events.
- Reuses `emailTemplateEngine`, `brands`, `email_suppressions`, `useTasks`, and the existing Teams notify function.
- Marketing subdomain verified in Resend; DNS records (SPF/DKIM/DMARC) provided for you to add.

## Delivery phases

1. Schema + Marketing shell, Audiences, lead fields on contacts.
2. EDM builder (blocks + HTML) with preview and test send.
3. Campaign queue, sending worker, tracking and stats.
4. Landing pages, public form, preference centre.
5. Leads pipeline + automation rules + Teams/task wiring.
6. Brevo wind-down.
