# 12 — CRM as actually built (Phases 1–6)

The CRM is native to ART Admin. It is not Keap, not Brevo, not HubSpot. The Keap → Brevo migration console and both integrations were removed in the 2026 tidy-up; only historical identifier columns on `customers` remain.

Vocabulary that matters: a **Contact** is a person (`customers`). An **Enquiry** is an interest in travelling (`leads`). They are distinct records; one contact can have several enquiries over time.

## Phase 1 — CRM foundation

Tables: `leads`, `lead_stage_history`, `crm_lead_stages`, `crm_lead_sources`, `crm_lead_types`, `crm_lost_reasons`, `crm_settings`, `crm_activities`, `tour_interests`.

- Stages, sources, types and lost reasons are **configuration rows**, editable in Settings, not hard-coded.
- Stage changes are recorded by trigger (`leads_handle_stage_change`, `leads_log_created_stage`) into `lead_stage_history` — history cannot be lost by an interface bug.
- Reporting is done through RPCs (`crm_pipeline_summary`, `crm_funnel`, `crm_action_board`, `crm_data_quality`) over the views `crm_lead_facts` and `crm_lead_activity_facts`.
- Frontend: `src/hooks/useCrmSales.ts`, `src/components/crm/*`, `/leads`, `/leads/:id`.

## Phase 2 — Website forms and lead capture

- `landing_pages` defines a public form; `/f/:slug` renders it; `marketing-landing-page` serves the definition and `marketing-submit-lead` accepts it.
- `landing_page_submissions` (62 columns) preserves **exactly what was submitted**, as a historical record. Later edits to the contact or enquiry never rewrite a submission.
- Built-in questions are configurable per form (off / optional / required / reworded); the tour dropdown lists available future, non-sold-out tours with staff picks and optional extra choices; room types are editable choices.
- Matching, lead creation, task creation, consent and attribution are all handled by `_shared/leadIntake.ts`, so every source behaves identically.
- Admin view: Marketing → Submissions, with `crm-reprocess-submission` to re-run intake for a submission.

## Phase 3 — Microsoft 365 correspondence

See [15-microsoft-email.md](15-microsoft-email.md). `crm_emails`, `crm_email_contacts`, `crm_email_links`, `email_mailboxes`, `email_mailbox_access`, `email_sync_runs`; synced every 15 minutes; 12 months of history imported for each enabled mailbox.

## Phase 4 — Contact and enquiry consolidation

Contact record surfaces booking history, tour interests, tags, internal staff notes (never shown to customers), emergency contacts, avatar, marketing history and Outlook correspondence in one place. `customers.latest_tour_name` / `latest_tour_end_date` track the most recent completed tour, ignoring cancelled bookings.

## Phase 5 — Sales performance and automation

- Working-day aware response measurement (`crm_business_days`, `crm_business_hours`, `crm_weekend_days`) with a 4-hour first-response target by default.
- Stage-specific "going cold" thresholds (`crm_lead_stages.stale_after_days`), and a "next action" that means an actual Task Manager task — nothing else counts.
- Automation rules (`crm_automation_rules`) with cooldowns, previews and a run log (`crm_automation_runs`). Triggers include `no_next_action`, `stale_lead`, `overdue_next_action`, `awaiting_first_response`, `nurture_review_due`, `new_lead_unassigned`.
- Outcome capture requires a reason when an enquiry is lost.
- Booking value comes only from booking records; one booking credits at most one enquiry (`crm_booking_converts_lead`, `crm_link_booking_to_lead`).
- Frontend: `LeadInbox`, `CrmDashboard`, `LeadOutcomeDialog`, `LeadAttentionCard`, `CrmAutomationTab`, `AutomationRuleDialog`, `CrmSalesSettings`.

## Phase 6 — Campaign tracking, audiences and tour intelligence

- Tracking: `marketing-track` records opens and classified clicks into `campaign_events`; campaign HTML is instrumented at send time with safe HTTP(S) link rewriting and ART UTM parameters.
- Attribution: `crm_campaign_attribution` and `crm_lead_marketing_signals` credit an enquiry or booking only when the person arrived through a tracked link. Receiving an email never counts as attribution.
- Dynamic audiences extended with real booking conditions (`crm_contact_booking_facts`, using actual `booking_status` values, cancelled excluded) and nurture conditions (`crm_contact_nurture_facts`, including review-date windows). Membership resolves at send time, so booking automatically removes a contact from a "not booked" audience.
- Tour-level intelligence: `crm_tour_marketing_intelligence` and `crm_tour_marketing_people` power the Marketing tab on a tour (`src/components/tours/TourMarketingTab.tsx`, `src/hooks/useTourMarketingIntelligence.ts`) with audience, activity, sales outcome, a drillable funnel and conservative trend display.
- Every figure is labelled as unique contacts or as sends/events, and the tracking start date is shown so pre-Phase-6 campaigns are never presented as having zero engagement by fault.

## Current data state (live, 8 September 2026)

`leads`, `tour_interests`, `crm_activities`, `landing_page_submissions`, `crm_automation_rules`, `marketing_automation_rules`, `marketing_link_classifications` and `campaign_events` are all currently **empty**. `crm_settings.crm_era_start` is 1 September 2026. The CRM is built and configured but has not yet accumulated production enquiry data — so CRM screens will legitimately look empty, and click classifications must be configured before click intelligence produces anything.
