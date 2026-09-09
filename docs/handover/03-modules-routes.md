# 03 — Modules and routes

Routes are declared in `src/App.tsx`. Authenticated routes sit behind an auth guard plus, in several cases, a role guard.

## Public routes (no login)

| Route | Purpose | Backing function |
| --- | --- | --- |
| `/login`, `/forgot-password`, `/reset-password` | Staff auth | Supabase Auth |
| `/f/:slug` | Public Register Interest / Booking Enquiry forms | `marketing-landing-page`, `marketing-submit-lead` |
| `/update-profile/:token` | Customer profile + emergency/dietary update | `validate-profile-token`, `update-customer-profile` |
| `/update-travel-docs/:token` | Passport / visa details | `validate-travel-docs-token`, `update-travel-docs` |
| `/waiver/:token` | Waiver signing | `validate-waiver-token`, `submit-waiver` |
| `/select-pickup/:token` | Pickup selection | `validate-pickup-token`, `submit-pickup-selection` |
| `/custom-form/:token` | Tour custom forms | `validate-custom-form-token`, `submit-custom-form` |
| `/view-itinerary/:token` | Guest itinerary | `validate-itinerary-token` |
| `/email-preferences/:token` | Marketing preference centre | `marketing-preferences` |
| `/host-report/:token` | Host briefing report | `validate-host-briefing-token` |
| `/teams-oauth-complete` | Teams OAuth landing | `teams-oauth-callback` |
| `/oauth/consent`, `/.lovable/oauth/consent` | MCP OAuth consent screen | `mcp` |

All customer tokens are single-purpose, stored in `customer_access_tokens` (or the equivalent per-feature table) and expire after 168 hours.

## Authenticated routes

| Route | Module | Notes |
| --- | --- | --- |
| `/` | Dashboard (`Index`) | Widgets, alerts, missing-information summaries; layout saved per user (`user_dashboard_layouts`) |
| `/tours/:id` | Tour detail | Tabbed: Overview, Bookings, Hotels, Activities, Itinerary, Comms & Guest Docs, Reviews and Checks, Hosts Info, Custom Forms, Marketing, Settings |
| `/tours/:id/edit`, `/tours/:id/itinerary` | Tour editing and itinerary builder | |
| `/bookings/:id`, `/bookings/:id/edit` | Booking detail and edit | Passengers, passports, payments, comments, waivers |
| `/bookings/bulk-status` | Bulk booking status change | |
| `/contacts/:id`, `/contacts/:id/edit` | Contact record | Bookings, tour interests, tags, internal notes, Outlook correspondence, marketing history |
| `/leads`, `/leads/:id` | CRM enquiry inbox and enquiry detail | Stage, owner, next action, outcome, timeline |
| `/marketing` | Marketing hub | Campaigns, Audiences, Templates, Landing Pages/Forms, Submissions, Results, Automation |
| `/communications` | Communications hub | Sent emails, upcoming/scheduled, approvals, issues, website changes |
| `/tasks/:id`, `/tasks/:id/edit` | Task detail/edit | |
| `/todos`, `/notes`, `/calendar` | Personal workspace | Admin/Manager; shared staff leave visible on calendars |
| `/operations/bedding-review` | Bedding review | |
| `/operations/activity-bookings` (alias `/bookings/activity-bookings`) | Activity allocation | |
| `/operations/hotel-allocations` | Hotel allocation | |
| `/operations/booking-changes` | Change report | |
| `/operations/payment-status` | Consolidated payment position | |
| `/operations/missing-phone-numbers` (alias `/bookings/missing-phone-numbers`) | Data gap report | |
| `/wordpress-content` | Website content sync | Admin/Manager |
| `/data-health` | Integration and data health | Admin/Manager |
| `/art-ai` | In-app assistant | `art-ai-chat`; conversations purged on a retention schedule |
| `*` | Not found | |

Settings live inside `/` → Settings (`src/pages/Settings.tsx`) with tabbed sections: users and roles, departments, email templates and rules, automated reports, brands and theme, integrations (Xero, WordPress, Teams, Microsoft mailboxes, lead integrations), CRM configuration, backups, and general parameters.

## Permissions summary

| Role | Reach |
| --- | --- |
| `admin` | Everything, including user management, integrations, deletions |
| `manager` | Nearly everything operational; a subset of settings tabs |
| `booking_agent` | Day-to-day bookings and tasks |
| `agent` | View-only |
| `host` | Restricted, view-only, limited to assigned tours (Hosts Info, host briefing) |

Enforcement is layered: `usePermissions` hides or blocks in the interface, and RLS policies plus `has_role()` enforce the same boundaries in the database. See [06-security-rls.md](06-security-rls.md).
