---
name: Multi-Brand / Theme System
description: Per-tour brands controlling logo, colours, sender identity and company details across emails, itineraries and guest documents
type: feature
---
Tours can be assigned a Brand (public.brands table; tours.brand_id nullable FK).
Each brand has: name/legal_name/short_name, logo_url + email_header_image_url,
colours (color_primary/border/button/button_text/accent), sender_name,
from_email_client/operational, company_address/phone/website, footer_text,
is_default, is_active. Exactly one is_default (enforced by trigger).

Resolution: unset brand_id or missing fields fall back to the default brand
(seeded from the old general_settings values = Australian Racing Tours), so
nothing changes visually until a tour is reassigned.
- Frontend: src/hooks/useBrands.ts (useBrands, resolveBrand) + BrandsManagement
  admin UI (Settings > Brands, admin-only). Brand selector on AddTourModal + TourEdit.
- Edge functions: supabase/functions/_shared/brand.ts (getBrandForTour,
  getDefaultBrand, publicBrandPayload). Wired into send-booking-confirmation,
  send-waiver/pickup/custom-form/travel-docs/profile-update-request,
  send-host-briefing-email, send-itinerary-email, send-rooming-list,
  process-travel-docs-emails, generate-itinerary-document, and the six
  validate-*-token functions (return brand for guest pages).
- Guest pages (CustomForm/SignWaiver/SelectPickup/UpdateProfile/UpdateTravelDocs)
  render brand.logoUrl + brand.colorPrimary from the validation response
  (src/lib/publicBrand.ts).
Domains: all brands still send from already-verified domains; per-client
custom sending domains deferred.
