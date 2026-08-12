# Co-branded comms for partner bookings (ART + Racing Breaks)

Yes — understood. The cleanest way is **one co-brand record + booking-level assignment**, not a duplicate set of templates per tour.

## The idea in plain terms

1. Create a co-brand called "Australian Racing Tours & Racing Breaks" in Settings > Brands. It carries the co-branded header image (both logos), colours, sender name, from-addresses and footer wording.
2. On any booking, choose that co-brand. Everything the system emails to that guest (welcome, 100-day, 2-week, waivers, pickups, travel docs, itinerary, receipts) automatically renders in the co-branded skin.
3. Tours keep their own brand as the default. A booking with no co-brand assigned behaves exactly as today.
4. Templates are NOT duplicated. The same 100-day / 2-week templates are used; only the skin changes. Where wording must differ (welcome/booking confirmation), the template gets an optional partnership paragraph that only renders for co-branded bookings.

## Brand resolution order

```text
booking.brand_id  ->  tour.brand_id  ->  default brand
```

So a Racing Breaks guest on a mixed tour gets co-branding while everyone else on that same tour gets standard ART branding.

## What staff see

- Settings > Brands: add/edit the Racing Breaks co-brand (header image, colours, sender, footer, partnership blurb).
- Booking detail / edit: a "Brand" selector ("Tour default" or a co-brand), shown with a small badge on the booking card and in the bookings list so it's obvious which guests are partner bookings.
- Bookings tab: bulk action to assign a co-brand to selected bookings, for when a partner sends a group at once.
- Email preview and test sends use the booking's resolved brand, so staff can verify before sending.

## Content differences

- New brand fields: `partnership_note` (short line for headers/footers, e.g. "Booked through Racing Breaks — operated by Australian Racing Tours") and `partner_name`.
- Templates can use `{{brand.partnership_note}}`, `{{brand.partner_name}}` and a conditional block:

```text
{{#brand.partner_name}}
  Your tour is operated by Australian Racing Tours in partnership with {{brand.partner_name}},
  who handle your booking and invoicing.
{{/brand.partner_name}}
```

Nothing renders for non-partner bookings, so one template serves both audiences.
- Billing-specific emails (invoices/receipts) should be skipped for partner bookings where Racing Breaks invoices the client — reuse the existing "skips billing" behaviour, driven off the co-brand.

## Technical notes

- Migration: add `brand_id uuid references public.brands(id)` to `bookings` (nullable), plus `partner_name` and `partnership_note` to `brands`. Grants + RLS follow existing patterns for these tables.
- `supabase/functions/_shared/brand.ts`: add `getBrandForBooking(supabase, bookingId)` implementing the resolution order above; switch the per-guest senders (send-booking-confirmation, send-waiver/pickup/custom-form/travel-docs/profile-update-request, send-itinerary-email, automated + status-change queue processors, receipts) from `getBrandForTour` to `getBrandForBooking`.
- Merge fields: expose `brand.*` (including `partner_name`, `partnership_note`) to the template engine and the merge-field picker so staff can insert them.
- Frontend: brand selector in booking create/edit, badge in booking lists, bulk assign in the Bookings tab, and previews resolved per booking.
- Guest pages (waiver/pickup/custom form/profile/travel docs) already read brand from the validate-token responses — those switch to the booking's brand so the guest sees co-branded pages too.

## Out of scope for now

- A separate Racing Breaks sending domain (emails keep sending from verified ART domains, with co-branded visuals and reply-to).
- Partner-facing logins or portals.
