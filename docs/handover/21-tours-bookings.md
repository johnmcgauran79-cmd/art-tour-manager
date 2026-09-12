# 21 — Tours and bookings (the operational core)

This is the oldest and most business-critical part of the system. The CRM sits on top of it; it does not replace it.

## Tours

`tours` (72 columns) holds one departure: name, dates, capacity, status, pricing, payment schedule, integration identifiers (Xero), brand, DMC flag, provisional-dates flag and website description.

Status enum: `pending`, `available`, `limited_availability`, `closed`, `sold_out`, `past`, `archived`, `cancelled`.

Behaviour:

- `handle_new_tour` and `handle_tour_date_change` generate and shift dependent records.
- `handle_hotel_date_change` cascades tour-level hotel date changes into booking-level custom dates.
- Cancelling a tour cascades to its bookings and auto-archives after 7 days.
- `auto_archive_completed_tours` runs daily at 02:00 UTC.
- Tour duplication shifts dates by one year and deliberately clears notes and statuses.
- Deletion goes through `delete_tour_with_cascade` with multi-step confirmation — never a raw delete.
- Tour Readiness checks supplier-level completeness; the "Managed by DMC" toggle relaxes those checks.

Related tables: `hotels`/`hotel_bookings`, `activities`/`activity_bookings`/`activity_journeys`, `tour_itineraries`/`tour_itinerary_days`/`tour_itinerary_entries`/`tour_itinerary_day_images`, `tour_inclusion_items`, `tour_additional_info_sections`, `tour_pickup_options`, `tour_host_assignments`, `tour_custom_forms`, `tour_alerts`, `tour_ops_reviews`, `operations_documents`.

## Bookings

`bookings` (37 columns) links a tour to up to three passengers, each tied to a contact record (lead passenger, pax 2, pax 3, with linked CCs).

Booking status enum: `pending`, `invoiced`, `deposited`, `instalment_paid`, `fully_paid`, `cancelled`, `waitlisted`, `host`, `racing_breaks_invoice`, `complimentary`.

Rules that surprise people:

- `waitlisted` bookings do **not** count as confirmed for capacity, hotel or activity aggregates.
- `complimentary` behaves as fully paid, is coloured green, and skips invoice generation.
- `cancelled` is excluded from capacity, marketing facts and CRM booking facts.
- `racing_breaks_invoice` supports co-branded partner bookings.
- Bedding defaults to single and is constrained by passenger count.
- Activity passenger allocations persist explicit zero values — zero means "none allocated", not "unset".
- Tour Overview capacity is independent of passenger counts and must not mirror them.
- Deletion uses `delete_booking_with_cascade` / `delete_booking_simple`; restore is possible via `useRestoreBooking`.

Creation is a four-step wizard collecting core, medical and dietary details, and is blocked when the tour is missing required integration identifiers.

## Payments and Xero

`payment_workflow_status` covers `unpaid`, `partially_paid`, `fully_paid`, `cancelled`, `not_required`, `pay_on_the_day`. Xero invoices are created as DRAFT, mapped in `xero_invoice_mappings`, and receipts synced nightly into `xero_payment_receipts`. Status upgrade to Instalment Paid requires payments exceeding the total deposit. Xero calls use 300 ms spacing and 429 retry handling, with `xero_api_locks` preventing overlapping syncs.

## Alerts

`tour_alerts` covers oversold hotels/activities, cancellations, extra nights and unread email; unacknowledged alerts refresh on a 7-day cycle, and `refresh-tour-alerts` runs weekly.

## Live volumes

64 tours, 743 bookings, 6,637 contacts.
