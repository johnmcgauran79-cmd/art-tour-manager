# Data Health & Integration Status Panel

## What it is
A single page (`/data-health`) that answers two questions at a glance:

1. **Is our tour data complete?** — which upcoming tours are missing the information we need to operate them.
2. **Are our integrations healthy?** — Xero, Keap, WordPress, Resend/email, Teams: connected, last sync, recent failures.

Today this information is scattered: passport gaps live in Reports, activity discrepancies in Bookings > Reviews & Checks, Xero sync errors only surface in logs, WordPress link status only inside a tour. The panel centralises it and turns each gap into a one-click jump to the exact record that needs fixing.

## Part 1 — Data Health

### Scope
Only **active, non-archived, non-cancelled, non-test tours departing in the next 120 days** (window switchable: 30 / 60 / 120 / all upcoming). Waitlisted bookings are excluded from all counts, consistent with the rest of the system.

### Health score
Each in-scope tour gets a score out of 100. Start at 100 and deduct per open issue, weighted by how close the tour is to departure (issues on a tour departing in 14 days cost more than one 90 days out). Displayed as a coloured badge: green 90+, amber 70–89, red below 70.

The page header shows a portfolio-level score (weighted average) plus counts of red/amber tours.

### Checks per tour
| Check | Flags when |
| --- | --- |
| Passport details | Confirmed passengers with passport requested but not received |
| Phone numbers | Lead passengers with no mobile/phone |
| Emergency contacts | Passengers with no emergency contact name or number |
| Dietary/medical | Bookings never completed the profile step |
| Hotel allocation | Confirmed bookings with no hotel room assigned |
| Activity allocation | Bookings with no allocation on a tour activity (reuses `get_activity_allocation_discrepancies`) |
| Rooming/bedding | Bookings with passenger count that bedding can't satisfy |
| Waivers | Confirmed passengers with no signed waiver |
| Custom forms | Outstanding responses on a required tour form (exemptions honoured) |
| Pickups | Bookings with no pickup option selected where the tour has options |
| Payments | Overdue instalments / bookings still on Invoiced past the deposit due date |
| Ops readiness | Missing tour host, missing itinerary days, no guest document uploaded, capacity not set |
| Website | Tour not linked to WordPress, or approved website changes not yet published |
| Bounced email | Suppressed/bounced addresses on the tour |

Acknowledged items (existing acknowledgment tables for phones, bounced emails, activity discrepancies) are respected and shown separately as "Acknowledged" rather than open issues.

### Layout
- **Top row**: portfolio score, tours at risk, total open issues, issues resolved in the last 7 days.
- **Tours table**: tour, departure (dd/mm/yyyy), days out, pax, score badge, per-category issue chips. Row expands to list the exact bookings/passengers with a link to each booking, plus **Acknowledge** where the check supports it.
- **By-category tab**: flips the view — pick a check, see every affected record across all tours (useful for "chase all passports this morning").
- **Export CSV** on both views, and a filter/search box; saved views reuse the existing `useSavedViews` hook.

## Part 2 — Integration Status

A card per integration, each showing state (Connected / Degraded / Disconnected), last successful sync, last error, and a **Details** drawer with the recent event list.

| Integration | Source of truth |
| --- | --- |
| Xero | `xero_integration_settings` (token expiry), `xero_sync_log` (recent successes/failures), open invoice mapping issues, unposted payment receipts |
| WordPress | `wordpress_tour_links` (linked vs unlinked tours), `wordpress_integration_audit_logs` (recent publish failures) |
| Keap | last contact sync result from the audit/sync logs |
| Email (Resend) | `email_logs` send/failure rate last 24h, `email_suppressions` count, scheduled emails stuck past their send time |
| Microsoft Teams | `user_teams_connections` + `teams_channel_notify_config` (connected users, configured channels, recent notification failures) |
| Automations | `automated_email_log` / `automated_report_log` failures, plus queued approvals waiting over 24h |

Each card links to the place where the problem is fixed (Settings > Xero, Communications, tour Comms tab, etc.).

## Access
Admin and Manager see everything. Operations sees Data Health only. Hosts and Agents don't get the page or the nav item — enforced through `usePermissions`, matching existing patterns.

## Technical notes
- New route `/data-health` plus a sidebar entry under Operations; lazy-loaded like the other routes.
- Data comes from a small number of **tour-scoped aggregate queries** run per in-scope tour set (not per booking), plus the existing RPCs, to respect the egress rules — no global table scans. Counts are computed in a `useDataHealth` hook with React Query caching and a manual **Refresh** button.
- Integration status reads existing settings/log tables only; no new sync calls are triggered by opening the page.
- Two new dashboard widgets (optional, added to the widget registry so users can toggle them): **Data Health score** and **Integration status** — both compact summaries linking through to the page.
- No new tables required. If we later want trend lines ("score over time"), that would need a small daily snapshot table — not in this scope.

## Out of scope for this pass
Trend history/charts, automated chase emails triggered from the panel, and per-user "assigned to me" gap queues.
