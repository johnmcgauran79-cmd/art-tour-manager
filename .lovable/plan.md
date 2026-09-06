# CRM & Lead Management — audit and Phase 1 build

## 1. What already exists and gets reused (no rebuild)

- **Contacts** (`customers`) — already carry lead fields (`lead_stage`, `lead_source`, `lead_owner_id`, `interested_tour_id`, `lead_next_action_date`, `lead_notes`), marketing consent + timestamp + source, `latest_tour_name` / `latest_tour_end_date`, avatar, emergency and dietary details, Keap/Brevo ids.
- **Tags** — shared tag library with contact and booking tagging.
- **Tasks** — full task manager: statuses, priorities, categories, assignees, approvers, watchers, comments, attachments, subtasks, activity log, Teams notifications, and `task_entity_links` which already supports linking a task to a contact, tour, booking, hotel or activity. This stays the one and only task manager.
- **Forms** — `landing_pages` + `landing_page_submissions` already store public interest and booking forms, submitted payload, consent text, chosen tours, created task id, auto-tags and Teams notify.
- **Email marketing** — campaigns, audiences, recipients and per-recipient open/click/bounce events, suppressions, preference centre. Stays as-is; CRM plugs into it.
- **Bookings / tours / users / audit log / global search / MCP tools** — all reused.

## 2. Real gaps

1. One contact can only hold **one** lead. No separate opportunity record, so a person interested in Royal Ascot and Hong Kong, or enquiring again next year, overwrites the last enquiry.
2. No **stage history**, so no time-in-stage, first-response time or conversion duration.
3. No structured **tour interests** — interest is a single tour field, so "interested in Hong Kong but not booked" can't be answered reliably.
4. No **activity log** for calls, voicemails, meetings, notes, preferences and complaints, and therefore no relationship **timeline**.
5. No **attribution** beyond a free-text source (no medium, campaign, UTMs, referrer, external id).
6. No **lost reasons**, no **contact relationships**, no **lead inbox**, no **sales dashboard**.
7. Tasks can't record a CRM **outcome** or link to a lead.

## 3. Proposed schema changes (all additive, nothing dropped)

New tables, each with grants and staff-only RLS:

- `leads` — contact, type, primary tour, stage, priority, owner, source/attribution, passengers, estimated value, next action date, lost reason/notes, linked booking, converted_at, source submission id.
- `lead_stage_history` — lead, from/to stage, changed_by, changed_at.
- `tour_interests` — contact, tour, optional lead, interest level, status (interested / booked / lapsed), source, created_at.
- `crm_activities` — contact, optional lead, type (call, voicemail, email, meeting, note, preference, complaint, other), direction, outcome, occurred_at, body, staff, optional created task.
- `contact_relationships` — contact A, contact B, type, notes.
- `lead_sources` — configurable source list; `lead_types` and `lead_stages` config tables so stages/types are editable rather than hard-coded.

Additive columns:

- `customers`: `original_source`, `original_source_at`, `owner_id`, `last_activity_at`, `lifetime_bookings`, `lifetime_value` (maintained by trigger), `partner_referral`.
- `tasks`: `lead_id`, `customer_id`, `outcome`, `crm_type` — existing task behaviour untouched; `task_entity_links` gains a `lead` entity type.
- `landing_page_submissions`: `lead_id`, plus UTM/attribution columns; existing rows stay valid and immutable.

Existing `customers.lead_*` fields are kept and mirrored from the contact's most recent open lead, so today's Leads pipeline, audiences and MCP tools keep working while the new model takes over.

## 4. Phase 1 screens and workflows

1. **Contact 360°** — rebuild the contact page around quick actions (Call, Email, Note, Task, New Lead, Booking) and a summary strip (active leads, current bookings, past tours, interests, next task, last contact, lifetime bookings/value, original source, tags), with tabs: Overview, Timeline, Leads, Tour Interests, Bookings, Forms, Emails, Tasks, Notes, Documents.
2. **Lead record** — full lead screen: contact, tours, passengers, owner, source, stage, priority, next action, original form answers, activities, notes, tasks, emails, linked booking, stage history. Loud flag when an active lead has no next action.
3. **Pipeline** — configurable Kanban (New → Attempting Contact → Contacted → Qualified → Considering → Booking in Progress → Booked, plus Lost and Long-Term Nurture) with drag-to-move writing stage history, and filters for tour, year, owner, stage, source, priority, overdue, no-next-action.
4. **Lead Inbox** — daily worklist: new leads, due today, overdue, booking enquiries, recently active, no next action.
5. **Activity logging** — fast "Log activity" dialog from contact or lead, with optional follow-up task created in the existing task manager.
6. **Timeline** — merged chronological feed from forms, lead events, activities, tasks, marketing emails, bookings and payments, with type filters.
7. **CRM dashboard** — today's numbers plus performance (leads received, first response time, conversion %, pipeline value, revenue, time to booking) filterable by date, tour, staff, source.
8. **Form intake upgrade** — existing public forms now create or update a lead, write tour interests for every ticked tour, capture UTM/referrer attribution, assign the owner and keep creating the same tasks and Teams alerts as now.

## 5. Permissions

Staff-only across the board via existing role helpers: admin and manager full CRM; booking agents read plus write on their own leads, activities and tasks; hosts and agents excluded from CRM tables. Public form submission stays the only anonymous path and continues to run through the edge function, never direct table access. Marketing consent and sensitive notes remain visible to staff roles only.

## 6. Migration risks and how they're handled

- Contacts, tasks, bookings and tours keep their current shape; every change is an added column or a new table.
- Existing `customers.lead_*` data is backfilled into `leads` and `tour_interests` in one reversible step, and the old fields keep being maintained.
- The current Leads page and audience filters keep working throughout; they're switched to the new tables only once the new screens are verified.
- Existing form submissions are never rewritten — history stays exactly as submitted.

## 7. Sequence

Phase 1 (this build): schema + backfill → leads and pipeline → activities and timeline → contact 360° → lead inbox → dashboard → form intake upgrade.
Then, in order: Phase 2 form builder polish, Phase 3 Microsoft 365 email history, Phase 4 inbound lead API/Zapier/Meta, Phase 5 automation and sales reporting, Phase 6 deeper marketing-audience integration and campaign attribution, Phase 7 MCP/AI tools.

Phases 2–7 are separate builds, not part of this one.
