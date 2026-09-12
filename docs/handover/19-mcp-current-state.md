# 19 — MCP server, current state only

`supabase/functions/mcp/index.ts` exposes ART Admin as an MCP server named `art-tour-manager-wordpress-mcp`, version **2.8.0**, with **146 tool definitions**. Helper implementations live in `src/lib/mcp/tools/` and `src/lib/mcp/wordpress/`.

v2.7.0 added CRM/leads, marketing and communications coverage: leads and their timelines, CRM configuration and reports (pipeline, funnel, response, attribution, tour sales, action board, data quality), tour interests, automation rules and runs, public form submissions; marketing campaigns with deduplicated unique-contact stats, recipients, raw open/click events, audiences (live counting), tour marketing intelligence and drill-downs, link classification rules, per-contact marketing status and suppressions; Microsoft 365 correspondence search and full-message reads with per-mailbox access enforced. Safe lead writes (`update_lead`, `log_lead_activity`, `upsert_tour_interest`) are enabled. Sending tools (`send_marketing_campaign`, `schedule_marketing_campaign`, `send_individual_email`) are implemented but refuse to act unless the edge-function secret `MCP_SENDING_ENABLED` is `true`.

v2.8.0 added `get_data_quality`, which returns the Data Quality dashboard's own findings (duplicate contacts, missing phone/email/location, enquiry hygiene gaps, unhealthy Xero invoice links) from the `dq_contact_issues`, `dq_lead_issues` and `dq_finance_issues` database functions.

**Scope note: do not expand the MCP as part of this handover.** This chapter records what exists.

## What the tools cover

- **Tours** — list/get, create/update, status, inclusions, itinerary days and entries, additional info sections, attachments, document images, external links, pickup options, host assignments, ops reviews, custom forms, alerts, messages, email logs and rule overrides
- **Bookings** — list/get, recent bookings, passengers, passenger details, comments, invoices, travel docs, waivers
- **Contacts** — search, get, list their bookings
- **Hotels and activities** — create/update/delete, per-booking allocation, attachments, external links
- **Tasks** — list/get/create/update/delete, assignment, comments, subtasks, statuses
- **Finance** — Xero invoice lookup, outstanding invoices, payment summaries and explanations, payment exception report, ART-vs-Xero comparison, invoice mapping issues
- **Email** — templates, rules, scheduled emails, pending approvals
- **WordPress** — health check, find/get/list tours and pages, media search/get/upload, preview and push itinerary and inclusions, pull inclusions, sync day photos, update allowlisted tour fields, taxonomies

## Behaviour built into the server

- **RBAC** is enforced per tool; the caller's role decides what is available. Agents and hosts are effectively read-only.
- **Destructive tools require explicit confirmation** before they act.
- Dates are `YYYY-MM-DD` throughout; date grounding uses `_shared/artAiDates.ts`.
- The function is configured `verify_jwt = false` and performs its own caller authorisation.
- Deterministic skills exist for common questions (next departing tour, payment exceptions) rather than leaving the assistant to infer them.

## Cautions

- The MCP can write real production data. Treat any change to its tools with the same care as a change to the interface.
- Tool count and version drift easily; `rg -c 'name: "' supabase/functions/mcp/index.ts` gives the current count.
- The ART AI assistant (`art-ai-chat`, `/art-ai`) is a separate surface that shares the same skill and date helpers.
