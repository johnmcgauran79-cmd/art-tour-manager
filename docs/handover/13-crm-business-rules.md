# 13 — CRM business rules: configured vs hard-coded

## Configured in the database (change in Settings, no code change)

| Rule | Where | Live value |
| --- | --- | --- |
| Stage list, order, colour | `crm_lead_stages` | New, Attempting Contact, Contacted, Qualified, Considering, Booking in Progress, Booked, Long-Term Nurture, Lost / Not Proceeding |
| Which stages count as active | `crm_lead_stages.counts_as_active` | The first six only; Booked, Nurture and Lost are excluded |
| Which stages require a next action | `requires_next_action` | The first six |
| Going-cold threshold per stage | `stale_after_days` | New 1, Attempting Contact 2, Contacted 5, Qualified 7, Considering 14, Booking in Progress 5; Booked/Nurture/Lost none |
| Stages exempt from follow-up chasing | `exempt_from_followup` | Booked, Nurture, Lost |
| First-response target | `crm_settings.first_response_target_hours` | 4 |
| First-response basis | `crm_settings.first_response_basis` | `business` (working hours/days, not wall clock) |
| Owner warning / manager escalation | `owner_warning_days`, `manager_escalation_days` | 2 and 5 |
| CRM reporting era start | `crm_settings.crm_era_start` | 2026-09-01 — data before this is excluded from CRM performance reporting |
| Lead sources | `crm_lead_sources` | Google Organic, Google Ads, Meta, Facebook Lead Form, Instagram, EDM, Direct, Existing Client, Referral, Partner, and others |
| Lead types, lost reasons | `crm_lead_types`, `crm_lost_reasons` | Configurable |
| Automation rules and cooldowns | `crm_automation_rules` | None active yet |
| Audience definitions | `marketing_audiences.filters` (rule tree) | 5 audiences, all state-based |
| What a click means | `marketing_link_classifications` | None configured yet |

## Hard-coded in code (needs a developer)

| Rule | Where |
| --- | --- |
| Contact matching order: by id, then email, then name — and never overwrite an existing contact's name | `_shared/leadIntake.ts` |
| "Next action" means an open Task Manager task and nothing else | `useCrmSales.ts`, `crm_action_board` |
| Unknown passenger count is never treated as 1 | CRM sales logic |
| Nurture enquiries are never nagged for follow-up | Automation trigger logic + stage flags |
| Conversion = booked or eligible enquiries; passenger conversion is reported separately | `crm_funnel`, `crm_tour_sales` |
| One booking credits at most one enquiry | `crm_booking_converts_lead`, `crm_link_booking_to_lead` |
| Booking value comes only from booking records, never from an enquiry estimate | Phase 5 attribution logic |
| Attribution requires a tracked-link chain; receiving an email is not attribution | `crm_campaign_attribution`, `marketing-track` |
| Cancelled bookings never qualify a contact as "booked" | `crm_contact_booking_facts` |
| Replying to a customer does not close a task | CRM/task integration |
| A lost outcome requires a reason | `LeadOutcomeDialog` + validation |
| Working days/hours calculation | `crm_business_days`, `crm_business_hours`, `crm_weekend_days` |
| Trend percentages only shown when both periods have enough comparable activity (minimum 20 emailed contacts) | `TourMarketingTab.tsx` |
| Marketing eligibility (consent, unsubscribe, bounce) always wins over any other audience condition | `marketing_contact_eligibility` |
| Customer token expiry 168 hours; guest document signed URLs 28 days | Token functions |

## Booking and payment statuses used by CRM conditions

These are the real ART values from the `booking_status` enum, not parallel CRM statuses: `pending`, `invoiced`, `deposited`, `instalment_paid`, `fully_paid`, `cancelled`, `waitlisted`, `host`, `racing_breaks_invoice`, `complimentary`.

Behavioural notes carried over from the operational system: `complimentary` behaves as fully paid and skips invoice generation; `waitlisted` does not count as confirmed for passenger or hotel aggregates; `cancelled` is excluded from booking facts and intelligence.
