# 14 — ART Email Marketing (in-house)

ART's marketing system is built inside ART Admin. It is **not** Brevo, Mailchimp or Keap. Delivery is via Resend; everything else — audiences, templates, sending, tracking, attribution, reporting — is ART's own.

## Pieces

| Concern | Where |
| --- | --- |
| Campaigns | `marketing_campaigns`, Marketing → Campaigns |
| Recipients and per-person state | `campaign_recipients` |
| Opens and clicks | `campaign_events` (via `marketing-track`) |
| Audiences | `marketing_audiences` with a rule tree in `filters` |
| Templates | `edm_templates`, `email_templates`, custom cards/buttons, branded headers |
| Consent and suppression | `customers.marketing_consent`, `marketing_preferences`, `email_suppressions`, `email_events` |
| Sending | `marketing-send-campaign`, `process-scheduled-campaigns` |
| Preference centre | `/email-preferences/:token` + `marketing-preferences` |
| Click meaning | `marketing_link_classifications` |
| Reporting | Marketing → Results, `CampaignResultsTab.tsx`, `useMarketingIntelligence.ts` |
| Tour-level view | Tour → Marketing, `crm_tour_marketing_intelligence` |

## Audience builder

Audiences are a nested rule tree (`and`/`or` groups) evaluated at send time by `crm_audience_match` / `crm_audience_predicate`, with `crm_audience_summary` for counts. Available condition families:

- Contact facts: state, location, tags, travel history, lifetime value, latest completed tour
- Engagement: emailed/opened/clicked, meaningful clicks, recency
- Tour interest: interested in a specific tour
- Enquiry/lead: stage, source, owner
- **Booking (Phase 6):** has/has no booking, booked or not booked on a specific tour, has/has no future booking, booking status (real enum values), past traveller on a tour — via `crm_contact_booking_facts`, cancelled bookings excluded
- **Nurture (Phase 6):** is Long-Term Nurture, nurture tour, review date before/after/between, due this week/month, overdue, nurture reason — via `crm_contact_nurture_facts`

Because membership resolves at send time, a contact who books automatically stops qualifying for a "not booked" audience, and a contact who leaves nurture automatically leaves a nurture-only audience. There is no separate marketing database to keep in step.

Live audiences (all state-based, all active): Victorians (344), NSW (257), Queensland (234), Western Australia (90), South Australia (3,990).

## Eligibility always wins

`marketing_contact_eligibility` gates every send: a contact must have marketing consent, must not be unsubscribed via the preference centre, and must not be suppressed by bounce or complaint. No booking, lead or nurture condition can override this. Bounces arrive through `resend-webhook` and are recorded automatically; reactivation is manual.

## Sending behaviour

- Resend allows roughly 2 sends per second, so bulk sends are sequential with ~600 ms spacing. A large campaign takes real time; that is expected, not a hang.
- Scheduled campaigns are picked up every 5 minutes by `process-scheduled-campaigns`.
- Pre-send review exists, and failed recipients can be retried without resending to those who already received the campaign.
- Marketing sender identity comes from `MARKETING_FROM_NAME` / `MARKETING_FROM_EMAIL`; the `news.` subdomain is send-only, so `MARKETING_REPLY_TO` routes replies to the bookings inbox.
- Email layout is fluid 100% width with an 800px max width; complex blocks are wrapped in protected regions so the Quill editor cannot mangle them.

## Tracking (started with Phase 6)

`marketing-send-campaign` instruments campaign HTML: an open pixel plus rewritten HTTP(S) links routed through `marketing-track`, carrying ART UTM parameters. `marketing-track` records the event, classifies the link against `marketing_link_classifications` (which can tie a link to a tour and mark it meaningful, e.g. Register Interest), then redirects. Only exact configured tracking domains are accepted.

Consequences to be honest about:

- Campaigns sent before tracking existed have **no** opens or clicks, and the interface says so rather than showing zeros as performance.
- `marketing_link_classifications` is currently **empty** and `campaign_events` has **no rows**. Until classifications are configured and a tracked campaign is sent, meaningful-click and tour-click intelligence will correctly show nothing.

## Attribution rules

An enquiry or booking is credited to a campaign only when the person arrived through a tracked link (`crm_campaign_attribution`, `crm_lead_marketing_signals`, with attribution captured in `_shared/leadIntake.ts`). Receiving an email is never attribution. Booking value comes only from booking records, and one booking credits one enquiry. Unique-contact counts are deduplicated, so a contact who received several campaigns is counted once.

## Legacy surfaces still present

`brevo-sync` and `BREVO_API_KEY` remain for contact sync/migration; `keap-match-contacts-by-email` and `KEAP_API_KEY` remain for historical matching only. All Keap tour/client tagging was removed deliberately and must not be reintroduced.
