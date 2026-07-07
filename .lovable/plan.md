# Multi-Brand / Theme System

Let tours belong to a **Brand**. Every outgoing artefact (emails, tour documents, itineraries, guest documents) resolves its logo, colours, sender identity, and company details from the tour's brand — falling back to a default brand (Australian Racing Tours) when none is set.

## Goals
- Admin-managed set of brands (2–3 to start, expandable).
- Each brand controls: logo/email header image, colour scheme (border, button, button text, accent), sender identity (name + from address for client & operational emails), and company/footer details (legal name, address, phone, website).
- A **Brand** selector on each tour (defaults to Australian Racing Tours).
- All emails, itineraries, and guest/tour documents use the tour's brand.
- Emails still send only from your already-verified domains (no per-client domain setup now).

## Data model

New table `public.brands`:
- `name` (display name), `legal_name`, `short_name`
- `logo_url`, `email_header_image_url`
- `color_primary`, `color_border`, `color_button`, `color_button_text`, `color_accent` (hex strings)
- `sender_name`, `from_email_client`, `from_email_operational`
- `company_address`, `company_phone`, `company_website`, `footer_text`
- `is_default` (bool), `is_active` (bool), `sort_order`
- standard `id / created_at / updated_at`

Add `brand_id uuid` (nullable, FK → brands, `ON DELETE SET NULL`) to `public.tours`.

Migration also:
- Seeds one **Australian Racing Tours** brand from the existing `general_settings` values (header image, sender name, from-addresses, existing `theme_*` colours) and marks it `is_default`.
- Backfills `tours.brand_id` to the default brand for all existing tours.
- Grants: `SELECT` to `authenticated` and `anon` (guest documents/itineraries are viewed via public token pages, so brand data must be readable there); full CRUD to `authenticated` gated by RLS (admin-only writes via `has_role`); `ALL` to `service_role` (edge functions).
- Enforces a single default brand via a trigger.

## Brand resolution

One shared helper on both sides:
- **Frontend** `useBrand(tourId)` / `useBrands()` hooks + `resolveBrand(tour)` that returns the tour's brand or the default.
- **Edge functions** a small `_shared/brand.ts` (imported via relative path) with `getBrandForTour(supabase, tourId)` returning the brand row or default, plus a `getDefaultBrand()`. Returns a normalized object with the same field names as today's settings so call sites change minimally.

The existing `general_settings` email keys become the fallback/default only; the default brand record is the source of truth.

## Admin UI
- New **Brands** management card/tab in Settings (Admin-only, reusing `usePermissions`): list, add, edit, delete (block deleting the default), set default. Each brand form has logo upload (to existing `email-assets` bucket), colour pickers, sender identity fields, and company/footer fields. Live email-style preview panel.
- Existing "Email Header Image" + "Email Defaults" cards get a note that they set the default brand; values are migrated into the default brand.

## Tour UI
- Add a **Brand** dropdown to Tour settings/edit (`TourEdit` / tour settings tab), defaulting to Australian Racing Tours. Persist `brand_id`.
- Surface the brand name/logo subtly on the tour detail header so staff know which brand a tour uses.

## Wiring artefacts to the brand
Replace direct `general_settings` branding reads with brand resolution in:
- **Emails** (edge functions): `send-booking-confirmation`, `send-itinerary-email`, `send-rooming-list`, `send-waiver-request`, `send-pickup-request`, `send-custom-form-request`, `send-profile-update-request`, `send-travel-docs-request`, `send-host-briefing-email`, `send-activity-passenger-list`, `process-automated-emails`, `process-status-change-emails`, `process-scheduled-emails`, `process-travel-docs-emails`, `process-post-booking-emails`, and report senders — swap header image, sender name, from-address, button/border colours, and footer for the tour's brand.
- **Documents/itineraries**: `generate-itinerary-document` and the client-side report/PDF components (`reports/*`, itinerary/guest doc views) — use brand logo, colours, and company details.
- **Public token pages** (`ViewItinerary`, `SignWaiver`, `SelectPickup`, `UpdateProfile`, `UpdateTravelDocs`, `CustomForm`): brand the page from the tour's brand (logo + accent colours) instead of hard-coded ART.

Where an email/document isn't tied to a single tour (e.g. system welcome email, task notifications), it keeps using the default brand.

## Rollout / safety
- Fully backward compatible: unset `brand_id` and any missing brand field fall back to the default brand, which is seeded from today's exact values — so nothing visually changes until a tour is reassigned.
- Ship in order: (1) migration + default brand seed + backfill, (2) brand resolver helpers, (3) Settings Brands admin UI, (4) tour Brand selector, (5) wire emails, (6) wire documents/itineraries + public pages.

## Technical notes
- Colours stored as hex; convert where the email/doc templates expect it.
- Reuse the `email-assets` storage bucket for brand logos/headers.
- Keep edge-function imports on `esm.sh` and `verify_jwt = false` per project conventions.
- Follow Australian date formatting and existing terminology throughout.

## Open follow-up (not in this scope)
- Per-client custom sending domains (Resend domain verification) for true white-label — deferred until a corporate client needs it.
