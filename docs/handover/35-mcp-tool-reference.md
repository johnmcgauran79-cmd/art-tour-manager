# ART Admin MCP — Tool Reference

Version: **2.8.0** — **146 tools**.

Server: the `mcp` Edge Function of the ART Tour Manager (Supabase project `upqvgtuxfzsrwjahklij`).

## How to use this server

- Every call runs as the signed-in ART user. Most tools are restricted to Admin and Manager roles; agents/hosts get permission errors rather than data.
- Dates are always `YYYY-MM-DD`. Displayed dates in ART are Australian format (dd/mm/yyyy). Tour/booking logic uses Australian time.
- Read tools are safe to call freely. Write tools change live production data — confirm intent with the user first, especially anything named `delete_*` or `replace_*`.
- Contact/booking reads are deliberately minimised: passport, medical and emergency data only comes from the explicit passenger/travel-doc tools.
- Marketing metrics distinguish **unique contacts** from **events** (a contact emailed twice counts once as a contact, twice as sends). Never claim a campaign caused a booking without the attribution chain.
- Engagement tracking (opens/clicks) only exists for campaigns sent after tracking went live; older campaigns legitimately show zero.
- The three sending tools refuse to run unless `MCP_SENDING_ENABLED=true` is set on the server. They are off by default.

## Tours — read

| Tool | What it does |
|---|---|
| `list_tours` | List tours the signed-in user can access. By default returns SOONEST start date first (ascending), which is what you want for questions about the 'next departing tour' — the FIRST row is the next tour to depart. To reliably answer 'next departing tour', set `upcoming_only: true` (excludes tours that already started) and read the first row. Returns up to 200 tours by default (raise `limit` up to 500). Optionally filter by name/location search term, status, or upcoming-only. Set `sort: 'desc'` for most-recent-first. |
| `get_tour` | Fetch full details for a single tour by its id, including dates, pricing, capacity and host. |
| `get_next_departing_tour` | Deterministically return the SINGLE next departing tour the signed-in user is authorised to see: the earliest tour whose start_date is on or after the as-of date. Use this instead of list_tours whenever you need the 'next', 'upcoming' or 'soonest' tour — do NOT infer it from the order of list_tours. If as_of_date is omitted, the organisation's current date (Australia/Sydney) is used. Excludes archived tours always, cancelled tours unless include_cancelled, and test tours unless include_test_tours. Read-only. |
| `get_tour_itinerary` | Fetch the day-by-day itinerary for a tour, including days and entries with times and descriptions. |
| `list_tour_activities` | List activities for a given tour id, including dates, times, locations, transport and dress code. |
| `get_activity` | Fetch full details for a single activity, including pickup journeys and which bookings are attending. |
| `list_tour_hotels` | List hotels and hotel bookings for a given tour id, including check-in/out dates, bedding and allocated rooms. |
| `get_hotel` | Fetch a single hotel with all fields, hotel bookings, attachments and external links. |
| `list_tour_additional_info` | List the Additional Information sections for a tour, in display order. Use the returned ids to edit or delete sections. |
| `list_tour_attachments` | List all file attachments (guest docs, ops docs, etc.) uploaded against a tour. |
| `list_tour_external_links` | List external links (docs, photos, videos, references) attached to a tour. |
| `list_tour_pickup_options` | List configured pickup locations for a tour. |
| `list_tour_host_assignments` | List staff/host users assigned to a tour. |
| `list_tour_document_images` | List images uploaded against a tour's guest documents. |
| `list_tour_ops_reviews` | List operations review sign-offs recorded against a tour. |
| `list_tour_alerts` | List capacity, cancellation, unread-email and other alerts raised for a tour. |
| `list_tour_operations_documents` | List operations documents attached to a tour along with their sections/content. |
| `list_tour_custom_forms` | List custom forms attached to a tour, including their fields and submitted responses. |
| `get_tour_inclusions` | Read a tour's structured inclusion and exclusion items (in display order, with their ids) plus the tour's Website Description block. These are what publish to the WordPress tour page. Admin/manager only. |
| `get_tour_messages` | Read the three tour comms messages used in email templates: the Welcome Message (with its on/off switch, heading, body and sign-off), the Pickup/Arrival Message, and the Welcome Drinks Message. Also returns the uploaded pickup/arrival document (e.g. an arrivals map) and its public URL. Admin/manager only. |
| `list_activity_attachments` | List file attachments (contracts, briefs, tickets) uploaded against an activity. |
| `list_activity_external_links` | List external reference links attached to an activity. |
| `list_hotel_attachments` | List file attachments (contracts, rooming confirmations) uploaded against a hotel. |
| `list_itinerary_day_photos` | List the photos attached to a tour's itinerary days (max 3 per day). Returns each photo with its day number/date, caption, a temporary signed preview URL, and the WordPress media id once the photo has been synced to the website gallery (`wp_media_id` null = not yet on the website). Admin/manager only. |
| `get_attachment_download_url` | Create a temporary signed download link for a file already stored in the private attachments bucket. Pass the `file_path` returned by any list_*_attachments / upload_* tool. Admin/manager only. |

## Tours, itinerary & content — write

| Tool | What it does |
|---|---|
| `create_tour` | Create a new tour. Requires name, start_date, end_date (YYYY-MM-DD), and the number of days and nights. Optional fields set location, host, capacity, status and pricing. |
| `update_tour` | Update fields on an existing tour by id. Only the fields you provide are changed. Useful for editing dates, pricing, status, notes and operations notes while building a tour. |
| `create_itinerary` | Create the itinerary for a tour and auto-generate one day per date between the tour's start and end dates. Fails if an itinerary already exists for the tour. |
| `add_itinerary_day` | Add a single day to an existing itinerary. Provide the itinerary_id and the activity_date (YYYY-MM-DD). The day number is assigned automatically as the next in sequence. |
| `upsert_itinerary_entry` | Add a new entry to an itinerary day, or edit an existing one. To add, provide day_id and subject. To edit, provide entry_id. content is optional. |
| `delete_itinerary_entry` | Permanently delete a single itinerary entry by its id. |
| `delete_itinerary_day` | Permanently delete an itinerary day and all of its entries by the day id. |
| `replace_tour_itinerary` | Replace a tour's current itinerary in one call: every existing day and entry is deleted and rebuilt from the `days` array (day numbers assigned in array order, entry sort order in array order). Destructive — always show the user the new itinerary and confirm before calling. Creates the itinerary if the tour has none. Admin/manager only. |
| `reorder_itinerary_days` | Renumber the days of an itinerary. Provide `day_ids` in the order you want them shown — day_number is rewritten as 1,2,3… Every day of the itinerary must be listed. Dates are not changed. Admin/manager only. |
| `reorder_itinerary_entries` | Set the display order of the entries within one itinerary day. Provide `entry_ids` in the order you want them shown — sort_order is rewritten as 0,1,2… Every entry of the day must be listed. Admin/manager only. |
| `add_additional_info_section` | Add an Additional Information section to a tour. Provide the tour_id, a name, and the content (HTML or plain text). icon_name defaults to 'Info'. |
| `update_additional_info_section` | Edit an existing Additional Information section by its id. Only the fields you provide are changed. |
| `delete_additional_info_section` | Permanently delete an Additional Information section by its id. |
| `update_tour_inclusions` | Replace the full inclusion OR exclusion list for a tour with the supplied items, in the order given. Each item is one bullet on the website; light inline HTML (<b>, <i>, <a href>) is kept, block markup is stripped. This replaces the existing list for that kind — read it with `get_tour_inclusions` first. Nothing is published to the website until `wordpress_push_tour_inclusions` is called. Admin/manager only. |
| `reorder_tour_inclusions` | Set the display order of a tour's inclusion or exclusion items by listing their ids in the desired order (ids come from `get_tour_inclusions`). Admin/manager only. |
| `update_tour_website_description` | Set the tour's Website Description block — the HTML that publishes to the Tour Details section of the WordPress tour page (intro copy, notes and the inclusions copy shown there). Nothing goes live until `wordpress_push_tour_inclusions` is called. Admin/manager only. |
| `update_tour_messages` | Edit the tour comms messages shown in the tour's Comms → Messages tab and pulled into email templates: the Welcome Message (turn on/off with `welcome_message_enabled`, plus heading/body/sign-off), the Pickup/Arrival Message and the Welcome Drinks Message. Message bodies are rich text — pass simple HTML (<p>, <strong>, <em>, <ul>, <a href>). Only the fields you supply are changed. Admin/manager only. |
| `create_hotel` | Add a new hotel to a tour. |
| `update_hotel` | Update fields on an existing hotel by id. Only supplied fields are changed. |
| `delete_hotel` | Delete a hotel by id. This cascades to hotel bookings — confirm with the user first. |
| `upsert_hotel_booking` | Create a hotel booking (link a booking to a hotel with dates/bedding/room) or update it if hotel_booking_id is supplied. |
| `delete_hotel_booking` | Remove a hotel booking (unlink a booking from a hotel). |
| `create_activity` | Add a new activity to a tour. |
| `update_activity` | Update fields on an existing activity. Only supplied fields are changed. |
| `delete_activity` | Delete an activity by id. Cascades to activity bookings — confirm first. |
| `upsert_activity_booking` | Assign a booking to an activity with a passenger count, or update the count. Provide activity_booking_id to update, or activity_id + booking_id to create. |
| `delete_activity_booking` | Remove a booking's assignment to an activity. |
| `upload_tour_attachment` | Upload a document or image against a tour (guest docs, contracts, ops paperwork). Provide the file as base64 in `data_base64`, max 20MB. Appears in the tour's Attachments section. Admin/manager only. |
| `upload_activity_attachment` | Upload a document or image against an activity (contracts, briefs, tickets, dress code sheets). Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only. |
| `upload_hotel_attachment` | Upload a document or image against a hotel (contracts, rooming confirmations, invoices). Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only. |
| `upload_itinerary_document` | Upload (or replace) a tour's Itinerary Snapshot or Guest Document file on its itinerary. Choose `document` = 'itinerary_snapshot' or 'guest_document'. Any existing file for that slot is replaced and removed from storage. Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only. |
| `upload_tour_document_image` | Upload an image used in a tour's guest documents (max 10 per tour), with an optional caption. Provide the file as base64 in `data_base64`, max 20MB. Admin/manager only. |
| `upload_tour_pickup_document` | Upload the tour's Pickup/Arrival document (e.g. an arrivals map PDF) and attach it to the tour. Provide the file as base64 in `data_base64`, max 20MB. Replaces any existing pickup document. Returns a public URL you can hyperlink from the Pickup/Arrival message (e.g. 'For further details, see map here.'). Set `insert_link_text` to append that hyperlink to the message automatically. Admin/manager only. |
| `upload_itinerary_day_photo` | Upload a photo (JPEG/PNG/WEBP/GIF, base64 in `data_base64`, max 20MB) against one day of a tour's itinerary. Maximum 3 photos per day — delete one first with `delete_itinerary_day_photo` if the day is full. Photos live in the ART admin system; publish them to the website day gallery with `wordpress_sync_itinerary_day_photos`. Get day ids from `get_tour_itinerary`. Admin/manager only. |
| `delete_itinerary_day_photo` | Remove a photo from an itinerary day in the ART admin system (also deletes the stored file). The WordPress media library copy is left in place, but the photo drops out of the website day gallery the next time you run `wordpress_sync_itinerary_day_photos`. Must pass confirm=true. Admin/manager only. |

## Bookings, passengers & contacts

| Tool | What it does |
|---|---|
| `list_bookings` | List bookings for a given tour id, including passenger counts, status and accommodation dates. |
| `list_recent_bookings` | List bookings across all tours, filtered by created_at or updated_at date range. Use for questions like 'bookings in the last 7 days'. Defaults to last 7 days by created_at. Restricted to admin or manager. |
| `get_booking` | Fetch a minimised, non-sensitive operational overview of one booking by id: status, dates, passenger count, room/bedding type, accommodation dates, linked customer ids and operational flags. Excludes all passport, medical, emergency-contact and dietary data. Read-only; access is RLS-scoped to the signed-in user. |
| `get_booking_passenger_details` | Fetch full passenger details for a single booking, including passport details, travel docs, waivers, hotel, activity bookings, dietary and medical info. |
| `list_tour_passengers` | List all passengers on a tour with their names, contact details, dietary requirements, medical conditions and accessibility needs. |
| `list_booking_travel_docs` | List travel documents (passports, visas, etc.) recorded against a booking, including full passport numbers, DOB and nationality (admin/manager only). |
| `list_booking_waivers` | List signed / requested waivers for a booking or for all bookings on a tour. |
| `list_booking_comments` | List internal staff comments on a booking. |
| `get_customer` | Fetch a minimised, non-sensitive customer/contact profile by id: name, email, phone, location and created date. Excludes all passport, medical, emergency-contact, accessibility and dietary data, and internal external-CRM identifiers (e.g. Keap). Read-only; access is RLS-scoped to the signed-in user. |
| `search_customers` | Find customers/contacts by a free-text query matching first name, last name, preferred name, full name or email (case-insensitive, partial match). Use this FIRST to resolve a person's name (e.g. 'Jason Reed') into a customer_id before calling get_customer or list_customer_bookings. Returns minimised non-sensitive fields (id, name, email, phone, location). Read-only; RLS-scoped to the signed-in user. |
| `list_customer_bookings` | List every booking a customer is linked to (as lead, secondary or passenger 2/3), with tour name, dates, status, passenger count, room/bedding type and a current/upcoming/past classification. Includes a financial-summary availability flag but no financial figures and no sensitive passenger data. Read-only; RLS-scoped to the signed-in user. |

## Finance & Xero

| Tool | What it does |
|---|---|
| `list_booking_invoices` | List all Xero invoices linked to an ART booking, with totals, payments received, outstanding balance, invoice statuses and the ART booking payment status. Uses the canonical mapping for linkage and live Xero data for current amounts (falls back to cached mapping data with a stale warning if Xero is unavailable). Restricted to admin/manager. |
| `get_xero_invoice` | Fetch full LIVE detail for a single Xero invoice by invoice_id (Xero InvoiceID/GUID) or invoice_number: summary, line items, payments, contact and reference, plus the linked ART booking and its payment status. Restricted to admin/manager. |
| `get_booking_payment_summary` | Summarise a booking's financial position from its linked Xero invoices: total invoiced, total paid, total outstanding, current ART status and the expected status inferred from Xero payments (with a discrepancy flag). booking_contract_total is returned as null unless an authoritative stored total exists; a mismatch is never asserted without one. Restricted to admin/manager. |
| `list_outstanding_invoices` | List bookings with outstanding Xero balances (amount due > 0), optionally scoped to a tour. Returns booking, primary client, tour, invoice number, due date, total, amount paid, amount due and days overdue. Candidate invoices come from the canonical mapping cache; each is refreshed against live Xero for the current due date and amounts. Restricted to admin/manager. |
| `get_payment_exception_report` | Compute the ART payment-exception report for a tour using the canonical classification rules (deposit/instalment/final-balance). Returns each exception booking with its primary and all applicable exception types, expected due date, expected amount with an explicit source label, and Xero monetary values (received/outstanding) labelled by source. This RE-COMPUTES the rules; it does not fetch a previously generated report artifact. Does NOT change any data. Restricted to admin/manager. |
| `compare_art_payment_report_to_xero` | For the bookings in a tour's ART payment-exception report, compare the ART position to the live Xero position and surface discrepancies (e.g. ART outstanding but Xero paid, and vice versa) using conservative rules. Scope is TOUR/REPORT SCOPED — it does NOT perform organisation-wide orphan-invoice detection; XERO_INVOICE_NOT_LINKED_TO_BOOKING is only reported for invoices encountered within this scope. Duplicate links, stale cache and incomplete live verification are flagged and never treated as confirmed financial discrepancies. Does NOT change any data. Restricted to admin/manager. |
| `explain_booking_payment_position` | Explain one booking's payment position: the ART classification (primary + all applicable exceptions with expected amounts and source labels), the live Xero position (active invoices only; voided/deleted excluded, credit notes respected), a conservative status comparison (only 'fully paid' when ALL active linked invoices have no amount due), duplicate-link findings, and informational date differences. Never asserts a discrepancy from stale cache alone or from aggregate-total comparisons. Does NOT change any data. Restricted to admin/manager. |
| `list_invoice_mapping_issues` | Audit bookings whose linked Xero invoice is unhealthy: the mapped invoice is DELETED or VOIDED in live Xero, or the mapped invoice number disagrees with the booking's invoice_reference field. Each mapping is refreshed against live Xero (falling back to the cached mapping with a stale_warning when Xero is unavailable). Optionally scope to a tour. Read-only; changes nothing. Restricted to admin/manager. |

## Email operations (transactional)

| Tool | What it does |
|---|---|
| `list_email_rules` | List active automated email rules (email templates) and their ids. Use these ids in `include_in_email_rules` on an Additional Information section to make the section appear as an info block in those emails. |
| `list_email_templates` | List all email templates (name, subject, body, category). |
| `list_tour_email_logs` | List sent-email logs for a tour (subject, recipient, status, error, sent_at). Filter with booking_id or a limit. |
| `list_tour_email_rule_overrides` | List automated-email rule overrides configured for a specific tour (custom templates, disabled rules, etc.). |
| `list_scheduled_emails` | List emails scheduled for future delivery. Filter by tour_id or booking_id. |
| `list_pending_email_approvals` | List status-change email approvals currently awaiting review. Filter by tour_id. |

## CRM & leads

| Tool | What it does |
|---|---|
| `list_leads` | List CRM leads/enquiries with filters: stage key, owner_id, tour_id (tour of interest), source, lead_type, needs_attention, in_nurture, created_from/created_to (YYYY-MM-DD). Ordered by most recent activity. |
| `get_lead` | Full detail for one lead/enquiry: the lead record, the linked contact, tour interests, stage history and recent CRM activity. |
| `list_lead_activities` | Timeline of CRM activity (calls, emails, notes, stage changes, marketing signals) for a lead or a contact. Filter by activity_type, meaningful-only, and date range. |
| `list_tour_interests` | Contacts who have registered interest in a tour (or the tours one contact is interested in), with interest level, status and source. |
| `list_crm_settings` | The CRM's configuration: lead stages (open/won/lost, cold thresholds), lead sources, lead types, lost reasons and the sales settings (response targets, escalation days). |
| `get_data_quality` | List data problems that distort reports and AI answers: duplicate contacts (email or name), missing phone on upcoming travellers, missing/invalid email, missing state/country, enquiry hygiene gaps (no owner, no tour, unknown passengers, lost without reason, won without booking, no source) and unhealthy Xero invoice links (deleted/voided, reference mismatch, invoiced but unlinked). Mirrors the Data Quality dashboard; items staff marked 'not a problem' are excluded by default. |
| `get_crm_report` | Run one of the CRM's own reports and return its real figures: pipeline_summary, funnel, response_performance, attribution_performance, tour_sales, action_board, data_quality. Date range applies where the report supports it. |
| `list_crm_automation` | CRM automation rules (triggers, conditions, actions, cooldowns) and, optionally, their recent run log so you can see what fired and what failed. |
| `list_form_submissions` | Register-Interest and Booking form submissions exactly as submitted, with processing status, matched contact/lead, tour(s) and campaign attribution (utm fields). |
| `list_lead_forms` | The public forms (Register Interest, Booking) including slug, form type, tour choices, field configuration, submission count and follow-up settings. |
| `update_lead` | Update a lead's stage, owner, priority, notes, next action, estimated value, passenger count, nurture review date or lost reason. Only supplied fields change. Stage changes are recorded in the lead's history by the system. |
| `log_lead_activity` | Record a call, note, meeting or other activity on a lead or contact's timeline. This only writes history — it never sends anything. |
| `upsert_tour_interest` | Record that a contact is interested in a tour, or update the interest level/status/notes on an existing interest record. |

## Marketing & campaign intelligence

| Tool | What it does |
|---|---|
| `list_marketing_campaigns` | Marketing campaigns (EDMs) with status, schedule and headline stats: recipients, sent, failed, opens, clicks, bounces, unsubscribes. Counts are events; use list_campaign_recipients for unique contacts. |
| `get_marketing_campaign` | One campaign plus reconciled results: unique contacts sent/delivered/opened/clicked, event totals, and the most-clicked links. Unique-contact figures never double-count a contact. |
| `list_campaign_recipients` | Per-contact results for a campaign: status, sent/opened/clicked timestamps and counts. Filter to only openers, only clickers, only failures, or a status. |
| `list_campaign_events` | Raw open and click events for a campaign, including the exact link clicked. These are events, not unique contacts. |
| `list_marketing_audiences` | Saved dynamic audiences with their filter rules and last counted sizes. Audiences resolve at send time, so counts here are the last calculation. |
| `count_marketing_audience` | Resolve an audience live and return its size, using the saved audience (audience_id) or ad-hoc rules JSON in the same shape the audience builder uses. Consent, unsubscribes, bounces and suppressions always apply. |
| `list_marketing_link_rules` | Link classification rules that turn clicked URLs into meaning (high intent, register interest, tour-specific), including the tour each rule maps to. |
| `get_contact_marketing_status` | Whether a contact can be marketed to (subscription, unsubscribe, bounce suppression) plus their campaign history with opens and clicks, their leads and their tour interests. |
| `list_email_suppressions` | Suppressed email addresses with type, reason and bounce counts. These addresses are always excluded from sending regardless of audience rules. |
| `get_tour_marketing_intelligence` | Per-tour marketing funnel: interested contacts, marketing-eligible, active and nurture leads, booked passengers, contacts emailed, opens, clicks, meaningful tour clicks, enquiries and bookings attributed, plus the previous comparable period. Unique-contact and event figures are labelled separately. |
| `list_tour_marketing_people` | Drill into a tour marketing figure and list the actual contacts: interested, interested_not_booked, nurture_leads, active_leads, emailed, opened, clicked, meaningful_clicks, enquiries, bookings. |

## Communications hub (Microsoft 365)

| Tool | What it does |
|---|---|
| `list_mailboxes` | Microsoft 365 mailboxes connected to the communications hub, with sync status, last successful sync, history depth and any error. Only mailboxes the signed-in user may read are returned. |
| `search_correspondence` | Search synced Microsoft 365 correspondence by text, contact, lead, tour, booking, mailbox, direction or date range. Returns subject, participants and a preview; set include_body for full text. Mailbox access rules apply. |
| `get_correspondence_message` | Full content of one synced message (body text and HTML, recipients, attachments) plus the contacts, leads, tours and bookings it is matched to. Optionally include the whole conversation thread. |

## Task Manager

| Tool | What it does |
|---|---|
| `list_tasks` | List tasks with optional filters. Filter by status, priority, category, tour_id, assignee_user_id, or search text in title/description. Returns up to `limit` (default 50, max 200) most recent tasks. |
| `get_task` | Return full task detail: task row, assignments, watchers, approvers, subtasks, comments, entity links, and attachments metadata. |
| `list_task_statuses` | List configured task status values (label, value, sort order, is_finished flag). |
| `create_task` | Create a task. Optionally assign users via `assignee_user_ids` (creates task_assignments rows). Status enum: not_started/in_progress/waiting/completed/cancelled/archived/not_required/with_third_party/awaiting_further_information/approval_required/approved/changes_needed. Priority: low/medium/high/critical. Category: operations/finance/marketing/booking/maintenance/general. Due date accepts YYYY-MM-DD (stored as literal date) or full ISO timestamp. |
| `update_task` | Update fields on an existing task. Only supplied fields are changed. Set status to 'completed' to complete a task. |
| `delete_task` | Permanently delete a task and its assignments/comments/subtasks (cascades). Confirm with the user first. |
| `add_task_comment` | Add a comment to a task. Optionally reply to another comment via parent_comment_id. |
| `assign_task` | Assign one or more users to a task (adds task_assignments rows; existing assignments unchanged). |
| `unassign_task` | Remove a user's assignment from a task. |
| `add_task_subtask` | Add a subtask (checklist item) to a task. |
| `update_task_subtask` | Update a subtask. Set completed=true to mark it done (fills completed_at/by). |
| `delete_task_subtask` | Delete a subtask from a task. |

## WordPress website

| Tool | What it does |
|---|---|
| `wordpress_health_check` | Confirm the WordPress REST API is reachable, authentication works, and the tour/pages/media endpoints are exposed. Never returns credentials. Admin/manager only. |
| `wordpress_list_tours` | List tours from the public WordPress site (custom post type 'tour'). Returns concise summaries only — no full HTML content. Admin/manager only. |
| `wordpress_get_tour` | Fetch a single WordPress tour by ID including raw editable content (context=edit), taxonomies, ACF/meta fields where exposed, and a content analysis flagging YOOtheme/scripts/iframes. Admin/manager only. |
| `wordpress_find_tour` | Search the WordPress tour custom post type by free text (title/slug/content). Returns likely matches with IDs and public URLs. Admin/manager only. |
| `wordpress_list_pages` | List standard WordPress pages. Concise summaries only. Admin/manager only. |
| `wordpress_get_page` | Fetch a WordPress page by ID with raw and rendered content plus a content analysis flagging YOOtheme layouts and other builder markers. Admin/manager only. |
| `wordpress_get_media` | Fetch a WordPress media item by ID. Admin/manager only. |
| `wordpress_search_media` | Search the WordPress media library. Admin/manager only. |
| `wordpress_get_taxonomies` | Return WordPress standard categories, tags, and the custom 'tours' taxonomy terms with their IDs. Admin/manager only. |
| `wordpress_get_tour_itinerary` | Read the live itinerary currently published on a WordPress tour post. Returns the `itinerary` ACF repeater rows in order, each with its `date_event` heading and `details` HTML. Read-only, admin/manager only. |
| `wordpress_preview_tour_itinerary` | Dry run before publishing: renders the ART itinerary for a tour into WordPress repeater rows and diffs them row-by-row against what is live on the website. Changes nothing. Use this, show the diff to the user, then call `wordpress_push_tour_itinerary` to publish. Admin/manager only. |
| `wordpress_push_tour_itinerary` | Publish the ART itinerary for a tour to its linked WordPress tour post, replacing the live `itinerary` repeater rows (this is what guests see on the website). ART is the source of truth; the push is one-way ART → WordPress. Run `wordpress_preview_tour_itinerary` first, show the diff, and only call this once the user has approved — you must pass confirm=true. Every call is written to the WordPress audit log with a before/after snapshot. Admin/manager only. |
| `wordpress_update_tour_fields` | Update a safe subset of ACF fields on a WordPress tour: pricing (price, single_room_price, twin_room_per_person_price, double_room_per_person_price), payment_details, dates (start_date, end_date, time_frame), status, radio_book_now, add_download_brochure, attach_brochure_here (WordPress media attachment ID for the brochure PDF, or null to clear), location, and the repeaters inclusions / exclusions_details / faqs_list / add_review. Any other key is stripped. Admin/manager only; every call is written to wordpress_integration_audit_logs with a before/after ACF snapshot. Hotels 1-5 are NOT writable here — use wordpress_get_tour to inspect them. The itinerary repeater is handled by wordpress_preview_tour_itinerary / wordpress_push_tour_itinerary. |
| `wordpress_upload_media` | Upload a PDF or image (JPEG/PNG/WEBP/GIF) into the connected WordPress site's media library and return the new attachment id + source_url. Max 20MB. Provide the file as base64 in `data_base64`. Typical use: uploading a brochure PDF, then passing the returned id into `wordpress_update_tour_fields` under `acf.attach_brochure_here` (and setting `acf.add_download_brochure` to enable the download button). Admin/manager only; every upload is written to wordpress_integration_audit_logs. |
| `wordpress_sync_itinerary_day_photos` | Publish the photos attached to a tour's itinerary days (uploaded with `upload_itinerary_day_photo`) into the matching day galleries on the linked WordPress tour post. Any photo not yet in the WordPress media library is uploaded first, then each itinerary row's `gallery` is set to that day's photos in order (days with no ART photos keep whatever gallery is already live). ART is the source of truth and the sync is one-way ART → WordPress. Requires confirm=true; every call is audited with a before/after snapshot. Admin/manager only. |
| `wordpress_preview_tour_inclusions` | Dry run before publishing inclusions/exclusions/description: diffs the ART lists and Website Description against what is live on the linked WordPress tour page. Changes nothing. Show the diff to the user, then call `wordpress_push_tour_inclusions` with confirm=true. Admin/manager only. |
| `wordpress_push_tour_inclusions` | Publish a tour's inclusion/exclusion lists and Website Description to its linked WordPress tour page, replacing the live `inclusions` / `exclusions_details` repeaters and the Tour Details content. ART is the source of truth; the push is one-way ART → WordPress. Run `wordpress_preview_tour_inclusions` first, show the diff, and only call this once the user approves — confirm=true is required. Empty ART lists are never pushed (it will not blank the website). Admin/manager only. |
| `wordpress_pull_tour_inclusions` | One-time import: reads the live WordPress tour page's inclusions, exclusions and Tour Details description and copies them into ART for that tour. Call without confirm to preview what would be imported; call with confirm=true to write (this REPLACES the tour's ART lists). Admin/manager only. |
| `wordpress_pull_itinerary_day_photos` | Backfill: copies the photos already published in each WordPress itinerary day gallery into the matching ART itinerary day (max 3 per day, matched day by day in order). Days that already hold ART photos are skipped — ART stays the source of truth and nothing on the website changes. Call without confirm to preview; call with confirm=true to write. Admin/manager only. |

## Outbound sending (disabled by default)

| Tool | What it does |
|---|---|
| `send_marketing_campaign` | Send a prepared marketing campaign, or send a test copy to one address. DISABLED until ART authorises AI-initiated sending; until then it returns an explanation and sends nothing. Consent, unsubscribe and suppression rules always apply. |
| `schedule_marketing_campaign` | Schedule a prepared campaign for a future date and time, or clear an existing schedule. DISABLED until ART authorises AI-initiated sending; until then it changes nothing. |
| `send_individual_email` | Send or reply to an individual email from one of the connected Microsoft 365 mailboxes, optionally linked to a contact, lead, tour or booking. DISABLED until ART authorises AI-initiated sending; until then it returns an explanation and sends nothing. |

## Typical workflows

- **Sales review**: `get_crm_report` (pipeline_summary, funnel, response_performance) → `list_leads` with `needs_attention` → `get_lead` → `log_lead_activity` / `update_lead`.
- **Tour marketing review**: `get_tour_marketing_intelligence` → `list_tour_marketing_people` for the underlying contacts → `list_marketing_campaigns` / `get_marketing_campaign` for campaign detail.
- **Who is engaging**: `get_marketing_campaign` for reconciled totals → `list_campaign_recipients` (openers/clickers) → `list_campaign_events` for the exact links → `list_marketing_link_rules` to read what a click means.
- **Can we email this person**: `get_contact_marketing_status`, cross-checked with `list_email_suppressions`.
- **Individual correspondence**: `list_mailboxes` → `search_correspondence` → `get_correspondence_message`.
- **Audience sizing**: `list_marketing_audiences` → `count_marketing_audience` (resolves live, including booking and nurture criteria).
- **Payment queries**: `get_payment_exception_report` for a tour → `explain_booking_payment_position` for one booking → `compare_art_payment_report_to_xero` to check against live Xero.
