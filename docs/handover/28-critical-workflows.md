# 28 — Critical end-to-end workflows

Eight flows that must keep working. Break one of these and ART notices the same day.

## 1. Website enquiry → contact → enquiry → task

```text
/f/:slug  →  marketing-submit-lead  →  landing_page_submissions (immutable)
             →  _shared/leadIntake.ts
                ├─ match contact (email → mobile → name; never rename)
                ├─ create/reuse lead + tour_interests
                ├─ create follow-up task (by department)
                ├─ crm_activities timeline entry
                ├─ consent (only if ticked)
                ├─ acknowledgement email (Resend)
                └─ preserve attribution
```

Failure mode: submission is kept; reprocess from Marketing → Submissions.

## 2. Booking creation → invoice → payment status

```text
4-step wizard  →  bookings row (+ passenger contacts)
   ├─ blocked if tour lacks Xero/Keap identifiers
   ├─ xero-create-invoice → DRAFT invoice → xero_invoice_mappings
   ├─ sync-xero-payment-receipts (04:00 UTC daily) → xero_payment_receipts
   └─ status progresses: pending → invoiced → deposited → instalment_paid → fully_paid
```

Complimentary skips invoicing; waitlisted does not count toward capacity.

## 3. Booking status change → customer email

```text
status change  →  queue_status_change_emails (trigger)
              →  status_change_email_queue
              →  process-status-change-emails
              →  approval queue (where configured) → Resend
              →  email_logs / email_events
```

## 4. Marketing campaign send → tracking → attribution

```text
campaign + audience  →  crm_audience_match at send time
                        (marketing_contact_eligibility gates everyone)
   →  marketing-send-campaign: instrument HTML (pixel + rewritten links + UTM)
   →  sequential send via Resend (~600ms apart)  →  campaign_recipients
   →  recipient opens/clicks  →  marketing-track  →  campaign_events (+ classification)
   →  tracked link → form submission → lead  →  crm_campaign_attribution
   →  booking  →  crm_booking_converts_lead (one booking, one enquiry)
   →  Marketing → Results and Tour → Marketing
```

Receiving an email is never attribution.

## 5. Microsoft mailbox sync → contact correspondence

```text
ms-mail-delta-sync (every 15 min)  →  ms-mail-sync (delta)
   →  Graph  →  crm_emails  →  crm_email_contacts / crm_email_links
   →  visible on Contact, gated by email_mailbox_access
   →  email_sync_runs records every attempt
```

## 6. Customer self-service via token

```text
staff sends request  →  customer_access_tokens (168h expiry)
   →  customer opens /profile|/travel-docs|/waiver|/pickup|/form/:token
   →  validate-*-token  →  submit/update-*  →  customer_profile_updates / booking_* tables
   →  staff sees the change; tour-level tracking updates
```

## 7. Tour operations lifecycle

```text
create tour  →  handle_new_tour + generate_tour_operation_tasks
   →  hotels/activities/itinerary built  →  Tour Readiness checks (relaxed if DMC-managed)
   →  bookings allocated (auto_allocate_hotel_to_bookings)
   →  capacity monitored (check_hotel_oversold / check_activity_oversold → tour_alerts)
   →  guest documents + itinerary sent
   →  tour passes  →  auto_archive_completed_tours (02:00 UTC)
   →  recompute_customer_latest_tour updates the contact's latest completed tour
```

## 8. Website content publish

```text
ART tour content  →  preview diff (wordpress_preview_*)
   →  staff approves  →  push (allowlisted fields only)
   →  WordPress REST  →  wordpress_integration_audit_logs
   →  website change event → Teams notification
```
