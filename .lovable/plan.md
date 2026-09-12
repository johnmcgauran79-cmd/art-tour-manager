# Data Quality Dashboard

One page that shows every data problem that makes reports and AI answers wrong, with a direct link to the screen where each one gets fixed. Nothing existing is replaced — the new page gathers checks that today live in separate corners of the system.

## Where it lives

New page **Data Quality** at `/data-quality`, reachable from the sidebar under the existing Tour Readiness entry, plus a small summary card on the dashboard. Admin and manager only (agents/hosts do not see it), using the existing permission hook.

Tour Readiness stays as-is: it answers "is this tour ready to run". Data Quality answers "is our contact, lead and invoice data clean".

## What it checks

**Contacts**
- Duplicate contacts — same email, or same first + last name, grouped so each cluster is one row. Fix link opens the existing Merge Duplicates tool.
- Missing phone number on contacts with future travel. Fix link opens the existing Missing Phone Numbers page.
- Missing or clearly invalid email address.
- Missing home state/country (used in marketing audiences).

**Leads / enquiries** (from the existing `crm_data_quality` figures, already used on the CRM dashboard)
- Active enquiries with no owner, no tour, or unknown passenger count.
- Lost enquiries with no lost reason; won enquiries with no booking; bookings with no revenue.
- Enquiries with no lead source (breaks attribution reporting).
Each row links straight to the enquiry.

**Finance / Xero**
- Bookings with a Xero invoice link that is deleted or voided in Xero.
- Bookings whose invoice reference disagrees with the linked Xero invoice number.
- Bookings that look invoiced but have no Xero link at all.
Fix links open the booking and the existing invoice sync review.

## How it behaves

- Four score tiles at the top (Contacts, Enquiries, Finance, overall), same scoring style and badge component as Tour Readiness.
- Tabs per area, each a searchable table with an "Open" / "Fix" action per row and CSV export, matching the Tour Readiness layout.
- "Not a problem" dismissal for rows that are legitimately like that, so counts stay meaningful. Dismissals are per row and recorded with who dismissed them.
- Refresh button; counts also feed the dashboard card.

## Technical notes

- New read-only database functions: `dq_contact_issues()` (duplicates, missing phone/email/location, scoped to non-cancelled and future-travel contacts where relevant) and `dq_finance_issues()` (invoice mapping problems from `xero_invoice_mappings` + `bookings.invoice_reference`, cancelled bookings excluded). Both admin/manager gated via `has_role`, with grants to `authenticated` and `service_role`. Lead figures reuse `crm_data_quality`, extended to also return the offending row ids so the table can list and link them.
- New table `data_quality_dismissals` (issue key, entity id, user, timestamp) with RLS restricted to staff, following the pattern of the existing acknowledgment tables.
- New hook `src/hooks/useDataQuality.ts` (same shape as `useDataHealth.ts`), page `src/pages/DataQuality.tsx`, tables under `src/components/dataquality/`, reusing `HealthScoreBadge`, `downloadCsv`, Australian date formatting.
- Live Xero re-checking is not done in the page (rate limits); it reads the cached mappings and shows how stale they are, consistent with the MCP invoice audit tool.
- MCP: expose the two new checks as read-only tools so Codex/AI can query data quality directly.
