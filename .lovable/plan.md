# Host Pre-Tour Briefing Email

Automated email sent to each assigned tour host 7 days before tour start. Contains tour overview, meeting location, admin login info, first hotel, passenger summary, and a secure link to view/print the full Combined Host Information Report.

## What gets built

### 1. Database (migration)
- Add new rule type value `host_pre_tour_briefing` (no enum change needed — `rule_type` is already a free text column).
- Insert a default `email_template` of type `host_pre_tour_briefing` with the briefing content + merge fields.
- New table `host_briefing_tokens` (id, tour_id, host_user_id, token, expires_at, created_at). 7-day expiry per project convention. RLS: only service role + the host themselves can read.
- Track sends in existing `automated_email_log` (one row per host per tour).

### 2. Secure host report page
- New public route `/host-report/:token` rendering the exact same HTML as the existing `HostInfoHubReportModal` (reuses `useReportData` + same builder).
- Edge function `validate-host-report-token` checks token validity + expiry, returns `tourId` and host info.
- Page shows the report inline with a Print button (`window.print()`), so the host can view in browser or print to PDF themselves.
- No host login required to view via token (token is the auth).

### 3. Default email template content
Subject: `Your upcoming tour: {{tour_name}} — host briefing`

Body merge fields:
- `{{host_first_name}}`, `{{tour_name}}`, `{{tour_start_date}}`, `{{tour_end_date}}`
- `{{meeting_location}}` (from tour)
- `{{admin_website_url}}`, `{{host_username}}` (their email) + "use Forgot Password if needed" link
- `{{first_hotel_name}}`, `{{first_hotel_address}}`, `{{first_hotel_checkin}}`
- `{{passenger_count}}`, `{{booking_count}}`
- `{{combined_report_link}}` — token URL to the secure report page
- Editable from Settings → Email Management → Email Templates

### 4. Edge function `send-host-briefing-email`
- Input: `tourId`, `hostUserId`
- Looks up tour, host profile, first hotel by checkin date, passenger summary, generates 7-day token, renders template, sends via Resend.
- From: configured sender. To: host email. CC: admin@australianracingtours.com.au.

### 5. Scheduler — extend `process-automated-emails`
- New branch processing `rule_type = 'host_pre_tour_briefing'` rules.
- For each tour where `daysUntilTour <= rule.days_before_tour` (default 7), find all `tour_host_assignments`.
- For each host: create `automated_email_log` row (one per host), respect approval flow (`pending_approval` → `approved` → invoke `send-host-briefing-email`).
- Idempotency by `(tour_id, rule_id, host_user_id)`.

### 6. UI updates
- Add `{ value: 'host_pre_tour_briefing', label: 'Host Pre-Tour Briefing', templateType: 'host_pre_tour_briefing' }` to `RULE_TYPES` in `AutomatedEmailRulesManagement.tsx`.
- Add `recipient_filter = 'hosts'` option (recipient is the host, not bookings).
- Seed a default rule: 7 days before tour, requires approval, active.

## Out of scope
- Post-tour emails (will be next, per user request).
- Modifying the combined report itself (uses existing generator).

## Notes
- Token expiry: 7 days (matches project convention for customer access links).
- One log row per host (not per booking) — keeps the "Email Approvals" panel grouped by tour + rule.
- Hosts also receive their existing login (the email tells them their username = their email and to use Forgot Password).
