# Typography rules in the theme (brand) profiles

Goal: one place that defines the fonts and sizes used by every guest-facing
communication (emails, guest documents, itinerary pages), so body copy stops
drifting between 12px and 14px and section headings look identical everywhere.

My reading of the request — please confirm the two marked items:
- "AI sections" = **Additional Info** sections (the info blocks in emails and in
  the Guest Document). Assumed, not the ART AI assistant.
- "lowercase" = sentence case as typed (no forced UPPERCASE), not forcing every
  letter lowercase.

## What changes visually

1. **Body text**: Poppins, 12px, line-height 1.6 everywhere in comms — email
   shell, email template content, additional info blocks, itinerary blocks,
   hotel / tour detail / passenger cards, cancellation policy tables, guest
   document body copy and footers.
2. **Additional Info section headings**: bigger than today (15px → 18px),
   Larken, bold, no uppercase transform (as typed).
3. **Itinerary section headings**: rendered from the exact same heading rule as
   Additional Info headings — same font, size, weight, colour, casing. Removes
   the current uppercase gold day-name / section-title treatment mismatch.
4. Cover titles, welcome heading and other display headings keep their current
   larger sizes (they are display type, not section headings).

## Theme settings (Brands)

New nullable columns on `public.brands`, all falling back to the ART defaults so
nothing changes for a brand until it is edited:

- `font_body` (default `Poppins`), `font_heading` (default `Larken`)
- `body_font_size_px` (default `12`), `body_line_height` (default `1.6`)
- `section_heading_size_px` (default `18`), `section_heading_weight` (default `700`)
- `section_heading_uppercase` (default `false`)
- `small_text_size_px` (default `11`) for footers/meta

Settings → Brands gets a **Typography** card per brand exposing these, with a
small live sample showing a heading + body paragraph.

## Technical approach

- Extend `src/lib/brandFonts.ts` and `supabase/functions/_shared/brandFonts.ts`
  with a `buildBrandTypography(brand)` helper returning resolved tokens plus a
  `headHtml` block (`@font-face`, Poppins link, base `body/td/p/div/li/span`
  and `h1..h6` rules) and reusable inline-style strings:
  `bodyStyle`, `sectionHeadingStyle`, `smallStyle`.
- `supabase/functions/_shared/brand.ts` → include the new columns in
  `getBrandForTour` / `getDefaultBrand` / `publicBrandPayload`.
- Replace hardcoded `font-size:14px` / `15px` body and section-heading values in
  the comms senders with the resolved tokens: `send-booking-confirmation`
  (email shell, additional-info cards, hotel/tour/passenger cards, buttons'
  label size stays), `send-welcome-email`, `send-waiver-request`,
  `send-pickup-request`, `send-travel-docs-request`,
  `send-custom-form-request`, `send-profile-update-request`,
  `process-travel-docs-emails`, `send-itinerary-email`, `send-rooming-list`,
  `send-host-briefing-email`, `generate-itinerary-document`.
- `supabase/functions/_shared/guestItinerary.ts` + `generate-itinerary-document`
  print CSS: body 10.5pt → the brand body size, and `.section-title`,
  `.info-name`, `.day-name`, `.activity-title` all driven by the single section
  heading rule (drop `text-transform: uppercase`).
- Frontend previews that must match the sent email
  (`EmailTemplatePreviewModal`, `EmailPreviewModal`,
  `PendingEmailPreviewModal`) use the same tokens.
- Quill email editor default: body size default set to 12px so newly typed
  content matches (existing templates keep any explicit inline sizes; the
  sanitizer will normalise bare 14px body spans to the brand size).
- Marketing EDM builder blocks keep their own per-block controls but the
  default text/paragraph size drops to 12px.

## Out of scope

- No changes to admin UI typography (only guest-facing comms/documents).
- No re-writing of headings already edited inside existing email templates.
