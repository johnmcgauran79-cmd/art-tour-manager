# Tour Readiness — How It Works

A guide for the Operations team: what the scores mean, exactly which data points are read,
how each one affects the score, and where to change the rules.

All logic lives in one file: `src/hooks/useDataHealth.ts`. Everything below (weights,
thresholds, which statuses count as "ready") is editable there in plain lists.

---

## 1. The two separate scores

| Score | Question it answers | Categories |
| --- | --- | --- |
| **Operational readiness** (the headline score / coloured badge) | Can we actually run this tour? | Hotels, Activities, Tour setup, Payments, Website |
| **Guest data** (the outlined chip) | How complete is passenger-supplied information? | Passport details, Waivers, Phone numbers, Emergency contacts, Custom forms, Pickups |

**Guest-data gaps never reduce the operational readiness score.** They are reported
separately so chasing passengers doesn't make an otherwise well-run tour look red.

Colour bands (both scores): **green 90–100**, **amber 70–89**, **red below 70**.

The gold chips in the row header (e.g. "Activities 5") are **counts of open items**, not
scores. The score for each category appears when you expand the row.

---

## 2. What tours and bookings are included

**Tours in scope**
- `start_date` is today or later (departed tours drop out automatically).
- Status is not `cancelled`, `archived` or `past`.
- `is_test_tour` is false.
- Optional window: 30 / 60 / 120 days, or all upcoming. The dashboard widget uses 60 days;
  the per-tour badge uses all upcoming.

**Bookings counted**
- Excludes `cancelled` and `waitlisted` (consistent with pax counts elsewhere).
- Excludes placeholder rows (`host` status, "TBC" surnames, blank names).

---

## 3. How a score is calculated

1. **Checkpoints, not issues.** Each category collects a number of *applicable
   checkpoints* and how many *failed*. Example: a tour with 3 hotels has 15 hotel
   checkpoints (5 per hotel) plus 1 per booking for room allocation.
2. **Category score** = `(1 − failed ÷ applicable) × 100`. One recurring problem across many
   bookings can no longer zero a whole tour.
3. **Group score** = weighted average of the categories that actually applied. Categories
   that don't apply (e.g. no custom forms published) are simply left out — they never
   penalise the tour.
4. **Urgency amplifier.** The shortfall below 100 is multiplied by how close departure is:

   | Days to departure | Multiplier |
   | --- | --- |
   | 0–14 | 1.60 |
   | 15–30 | 1.35 |
   | 31–60 | 1.15 |
   | 61+ | 1.00 |

   So a raw 90 becomes 84 inside 14 days. The same gap costs more the closer we get.
5. **Portfolio score** (page header / widget) = plain average of the in-scope tours' ops
   scores. "At risk" = tours under 70; "warning" = 70–89.

### Category weights

| Group | Category | Weight |
| --- | --- | --- |
| Ops | Hotels | 30 |
| Ops | Activities | 30 |
| Ops | Tour setup | 25 |
| Ops | Payments | 10 |
| Ops | Website | 5 |
| Guest | Passport details | 25 |
| Guest | Waivers | 25 |
| Guest | Phone numbers | 20 |
| Guest | Emergency contacts | 15 |
| Guest | Custom forms | 10 |
| Guest | Pickups | 5 |

---

## 4. Every check, and the data it reads

### Operational readiness

**Hotels** — from `hotels`, `hotel_attachments`, `hotel_bookings`
- 5 checkpoints per hotel:
  1. `booking_status` must be one of `confirmed`, `contracted`, `paid`, `finalised`.
  2. `cancellation_policy` (cancellation & attrition terms) must not be blank.
  3. At least one contract file uploaded against the hotel.
  4. `rooms_reserved` > 0, and `rooms_booked` must not exceed it (oversold flags).
  5. `contact_name` and `contact_phone` both present.
- Plus 1 checkpoint per booking: a hotel room is allocated (`hotel_bookings` row with a
  hotel, ignoring cancelled allocations and rows marked not required).
- A tour with no hotels at all is a single failed checkpoint.

**Activities** — from `activities` and the `get_activity_allocation_discrepancies` RPC
- 5 checkpoints per non-cancelled activity:
  1. `booking_status` in `confirmed`, `finalised`, `booked`, `fully_paid`, `paid_deposit`.
  2. `payment_status` in `fully_paid`, `partially_paid`, `not_required`, `pay_on_the_day`.
  3. `spots_available` > 0 and `spots_booked` not exceeding it (oversold flags).
  4. Core details present: date, start time, location, supplier contact name + phone.
  5. `transport_status` in `booked`, `confirmed`, `paid_deposit`, `fully_paid`, `not_required`.
- Plus one checkpoint per allocation discrepancy (passenger counts vs activity
  allocations). Discrepancies already acknowledged in
  `activity_discrepancy_acknowledgments` are listed as **Acknowledged** and don't score.

**Tour setup** — 4 checkpoints from `tours`, `tour_itineraries`, `tour_attachments`
1. `tour_host` assigned.
2. Current itinerary exists and has days built.
3. A guest document exists (itinerary guest document file, or any tour attachment).
4. `capacity` set to a number greater than 0.

**Payments** — from `bookings` and `xero_invoice_mappings`; **only inside 30 days of departure**
- 1 checkpoint per booking. Fails when the booking isn't settled and Xero still shows an
  amount due. Statuses treated as settled: `fully_paid`, `complimentary`, `host`,
  `racing_breaks_invoice`. If there's no Xero mapping, the booking status alone decides.

**Website** — 2 checkpoints from `wordpress_tour_links`, `website_change_requests`
1. Tour linked to a WordPress tour.
2. No change requests sitting `pending` review or `approved` but unpublished.

### Guest data

| Check | Checkpoints | Reads | Fails when |
| --- | --- | --- | --- |
| Phone numbers | 1 per booking | lead contact `phone` | blank (acknowledged via `phone_missing_acknowledged_at` is excluded from scoring) |
| Emergency contacts | 1 per booking | lead contact `emergency_contact_name` / `_phone` | either blank |
| Passport details | 1 per passenger slot (max 3) | `booking_travel_docs.passport_number` | no passport number for that slot. Only applies when the tour has `travel_documents_required` and the booking isn't `passport_not_required` |
| Waivers | 1 per booking | `booking_waivers.signed_at` | no signed waiver. One signature from the lead booker covers the whole booking |
| Custom forms | 1 per published form per booking | `tour_custom_form_responses`, `tour_custom_form_exemptions` | no response and no exemption |
| Pickups | 1 per booking, only if the tour has pickup options | `bookings.selected_pickup_option_id` | nothing selected |

---

## 5. Where things are shown

- **Tour Health page** → Tour Readiness: portfolio score, per-tour rows, expandable item
  lists split into "Operational readiness" and "Guest data completeness".
- **Dashboard widget** "Ops Readiness": 60-day window, three worst tours.
- **Tour list / tour page**: the ops score badge per tour.
- Data is cached for 2 minutes; use Refresh to re-pull.

---

## 6. Knobs Operations can ask us to change

All in `src/hooks/useDataHealth.ts`, and all safe to tune:

1. **Category weights** — `DATA_HEALTH_CHECKS` (e.g. make Payments matter more than 10).
2. **Which statuses count as ready** — `HOTEL_READY_STATUSES`, `ACTIVITY_READY_STATUSES`,
   `PAYMENT_READY_STATUSES`, `TRANSPORT_READY_STATUSES`, `SETTLED_BOOKING_STATUSES`.
3. **Urgency multipliers and their day bands** — `urgencyMultiplier`.
4. **Colour bands** — `scoreTone` (currently 90 / 70).
5. **Payments lead time** — currently only scored inside 30 days of departure.
6. **Adding, removing or re-grouping a check** — e.g. move Waivers into Ops so it affects the
   headline score, or add checks such as host flights booked, rooming list sent,
   name tags produced, or supplier final numbers confirmed.
7. **Individual checkpoints inside a category** — e.g. drop "contract file uploaded" from
   Hotels, or require a hotel cancellation deadline date.

If the team wants a first pass, the most common requests are: re-weighting Hotels vs
Activities, softening the "no contract file" check, and deciding whether waivers/passports
should influence the headline score.
