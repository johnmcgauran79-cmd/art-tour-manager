# 14 — ART Email Marketing (in-house)

ART's marketing system is built inside ART Admin. It is **not** a third-party ESP. Delivery is via Resend; everything else — audiences, templates, sending, tracking, attribution, reporting — is ART's own.

## Pieces

| Concern | Where |
| --- | --- |
| Campaigns | `marketing_campaigns`, Marketing → Campaigns |
| Recipients and per-person state | `campaign_recipients` |
| Opens and clicks | `campaign_events` (via `marketing-track`) |
| Audiences | `marketing_audiences` with a rule tree in `filters` |
| Templates | `edm_templates`, `email_templates`, custom cards/buttons, branded headers |
| Consent and suppression | `customers.marketing_consent`, `marketing_preferences`, `email_suppressions`, `email_events` |
| Sending | `marketing-send-campaign`, `process-scheduled-campaigns` |
| Preference centre | `/email-preferences/:token` + `marketing-preferences` |
| Click meaning | `marketing_link_classifications` |
| Reporting | Marketing → Results, `CampaignResultsTab.tsx`, `useMarketingIntelligence.ts` |
| Tour-level view | Tour → Marketing, `crm_tour_marketing_intelligence` |

## EDM builder (canvas editor)

`EdmBuilder.tsx` is a single-canvas editor: the branded preview *is* the editing surface.

- `EdmCanvas.tsx` writes the interactive email HTML into a same-origin iframe, makes elements carrying `data-edm-edit` contenteditable, and commits their content back through `updateBlockById` on blur (so undo/redo, autosave and dirty state are unchanged). A floating toolbar gives bold/italic/underline/strikethrough, colour, lists, links and merge-field insertion; canvas-authored HTML is reduced to email-safe tags by `src/lib/edm/sanitizeHtml.ts`.
- `EdmPalette.tsx` is the block palette on the right: drag a tile onto the email (insert line shows the drop point, empty columns highlight) or click a tile then click where it goes.
- The same right-hand panel switches to `BlockInspector` settings for the selected section, with the Desktop / Mobile switch driving mobile overrides. Clicking the email background opens the whole-email design block.
- `data-edm-edit`, `data-edm-block`, `data-edm-cell` and the empty-column hint are emitted **only** when `renderEdmHtml(..., { interactive: true })` is used by the builder — sent email HTML never contains them.
- HTML mode is unchanged: raw source on the left, preview on the right.

## Audience builder

Audiences are a nested rule tree (`and`/`or` groups) evaluated at send time by `crm_audience_match` / `crm_audience_predicate`, with `crm_audience_summary` for counts. Available condition families:

- Contact facts: state, location, tags, travel history, lifetime value, latest completed tour
- Engagement: emailed/opened/clicked, meaningful clicks, recency
- Tour interest: interested in a specific tour (single or several)
- Enquiry/lead: stage, source, owner
- **Booking (Phase 6):** has/has no booking, booked or not booked on a specific tour, has/has no future booking, booking status (real enum values), past traveller on a tour — via `crm_contact_booking_facts`, cancelled bookings excluded
- **Nurture (Phase 6):** is Long-Term Nurture, nurture tour, review date before/after/between, due this week/month, overdue, nurture reason — via `crm_contact_nurture_facts`

Tour conditions accept **multiple tours**: the `in` ("is any of") operator plus a multi-select tour picker in `AudienceRuleBuilder.tsx`, resolved by `tourValues()` in `audienceRules.ts`. This covers interested-in, booked-on, travelled-on and nurture-tour conditions, so one campaign can target a single tour's booking list or several tours at once (e.g. first-refusal rebooking offers). `eq` (single tour) still works on existing audiences.

Because membership resolves at send time, a contact who books automatically stops qualifying for a "not booked" audience, and a contact who leaves nurture automatically leaves a nurture-only audience. There is no separate marketing database to keep in step.

Live audiences (all state-based, all active): Victorians (344), NSW (257), Queensland (234), Western Australia (90), South Australia (3,990).

## Eligibility always wins

`marketing_contact_eligibility` gates every send: a contact must have marketing consent, must not be unsubscribed via the preference centre, and must not be suppressed by bounce or complaint. No booking, lead or nurture condition can override this. Bounces arrive through `resend-webhook` and are recorded automatically; reactivation is manual.

## Sending behaviour

- Resend allows roughly 2 sends per second, so bulk sends are sequential with ~600 ms spacing. A large campaign takes real time; that is expected, not a hang.
- Scheduled campaigns are picked up every 5 minutes by `process-scheduled-campaigns`.
- Pre-send review exists, and failed recipients can be retried without resending to those who already received the campaign.
- Marketing sender identity comes from `MARKETING_FROM_NAME` / `MARKETING_FROM_EMAIL`; the `news.` subdomain is send-only, so `MARKETING_REPLY_TO` routes replies to the bookings inbox.
- Email layout is fluid 100% width with an 800px max width; complex blocks are wrapped in protected regions so the Quill editor cannot mangle them.

### Warm-up ramp (September 2026)

- The pre-send review dialog has a third mode, **Warm-up ramp**: choose emails per day and an optional start date.
- `marketing_campaigns.daily_send_limit` caps sends per day; `ramp_sent_date` / `ramp_sent_count` track the day's tally (Australia/Melbourne).
- All recipients are queued up front with `campaign_recipients.send_priority` from `warmupPriority()` in `src/lib/edm/audience.ts`: 10 = travelled in the last 18 months, 20 = travelled earlier, 30 = created/enquired in the last 12 months, 40 = coldest. The queue is drained in `send_priority, created_at` order.
- `marketing-send-campaign` (`process`) returns `dailyLimitReached` once the day's allowance is spent; `process-scheduled-campaigns` stops for the day and leaves the campaign in `sending` so the rest goes out the next day.
- Reputation guidance: 500 → 1,000 → 2,000 → remainder, pausing if bounces exceed ~2%.

## Tracking (started with Phase 6)

`marketing-send-campaign` instruments campaign HTML: an open pixel plus rewritten HTTP(S) links routed through `marketing-track`, carrying ART UTM parameters. `marketing-track` records the event, classifies the link against `marketing_link_classifications` (which can tie a link to a tour and mark it meaningful, e.g. Register Interest), then redirects. Only exact configured tracking domains are accepted.

Consequences to be honest about:

- Campaigns sent before tracking existed have **no** opens or clicks, and the interface says so rather than showing zeros as performance.
- `marketing_link_classifications` is currently **empty** and `campaign_events` has **no rows**. Until classifications are configured and a tracked campaign is sent, meaningful-click and tour-click intelligence will correctly show nothing.

## Attribution rules

An enquiry or booking is credited to a campaign only when the person arrived through a tracked link (`crm_campaign_attribution`, `crm_lead_marketing_signals`, with attribution captured in `_shared/leadIntake.ts`). Receiving an email is never attribution. Booking value comes only from booking records, and one booking credits one enquiry. Unique-contact counts are deduplicated, so a contact who received several campaigns is counted once.

## Legacy surfaces still present

The Keap → Brevo migration console, the `brevo-sync` and `crm-migrate-*` functions and the Keap contact-matching function were removed in the 2026 tidy-up. Brevo and Keap are no longer part of the system and must not be reintroduced. Historical `customers.keap_contact_id` / `brevo_contact_id` values are retained as read-only history.

### Typography & spacing controls (September 2026)

- **Fonts per block** — `EdmBlock.fontFamily` overrides the default stack for heading, text,
  button and quote blocks. Options come from `EDM_FONTS` in `src/lib/edm/blocks.ts` (Larken,
  Poppins plus email-safe stacks); `fontStack(block, fallback)` resolves it at render time.
- **Negative spacing** — the margin/padding editors accept -160..160. Negative sides are
  collected by `negativeSpacing()` and emitted as a negative CSS margin on the block's wrapper
  table (padding cannot be negative in email HTML).
- **Mobile stacked columns** — `EdmBlock.stackGap` adds `padding-bottom` to `td.edm-col` inside
  the block's mobile media query (last column excluded).
- **Font sizes** — heading and text blocks accept 6-96px (previously 10/8 minimum).
- **Footer line spacing** — `EdmBlock.footerLineHeight` (design block) drives the footer `td`
  line-height, including custom footer HTML.
- **Editor readability** — `EdmCanvas` adds `.edm-readable` to the focused editable element when
  its text/background contrast ratio is below 2.2, so white-on-white copy is visible while
  typing. The stored colour and the sent email are unaffected.

## Editor / sent-email parity (September 2026)

- The editing canvas renders the email at its real content width (design → max
  width) and scales the whole frame to fit the screen, so spacing, padding and
  header size match what recipients receive. Mobile view is a genuine 390px
  window and is never scaled.
- `EdmCanvas` adds no layout or typography overrides. Text size, line spacing
  and font come from the block and are written inline on the editable `div`
  (the brand stylesheet targets every `div/p/span`, so inheritance alone was
  keeping body copy on Poppins).
- `collectMobileCss()` emits per-block phone rules; there is no blanket
  16px/1.65 rule any more. Mobile padding/margin are independent of desktop
  (a deliberate 0 counts as a value).
- New phone-only settings: image full width, social icon size, header/logo
  width and header padding, footer icon size (`mobileHeaderWidthPct`,
  `mobileHeaderPadding`, `mobileIconSize`).
- Content can be dragged by the move handle into any column or between blocks
  (`moveBlockToCell`). Columns can be emptied or deleted individually.
- Links never navigate in the editor (capture-phase `preventDefault`), the top
  toolbar is sticky, negative column padding/gaps render as negative margins,
  and images can be re-picked from the uploaded `email-assets/edm` library.

## Delivered-email parity: negative spacing (late September 2026)

Gmail, Outlook and Apple Mail discard negative CSS margins, so blocks pulled tighter in the editor arrived with the full gap. Negative padding/margin is now converted into real padding before the email HTML is built: the block's own space is trimmed first, then the facing space on the neighbouring block. Editor and delivered email now lay out identically (desktop was the only view affected; phone view has its own padding rules).

Also in the editor: a YouTube video block (`youtubeVideoId`, thumbnail, caption, link), 15-second autosave on templates and campaigns, a "Row" toolbar action with row highlighting, independent scrolling for the email and settings panes, per-side spacing entry ("All sides together" vs "Each side on its own"), and a test-email dialog that opens over the editor without closing it.

## Editor reliability safeguards (24/09/2026)
- `sanitizeEdmHtml` keeps the same formatting the settings-panel text editor produces (H1–H4, blockquote, font-size/family, line-height, letter-spacing, Quill indent classes), so canvas edits no longer strip it.
- Template and campaign saves pass `expectedUpdatedAt`; if the row changed elsewhere, `EdmSaveConflictError` is thrown, autosave pauses and `SaveConflictDialog` offers "Load latest" / "Keep my version".
- Saves are serialised (one in flight at a time) — templates via `runSave`, campaigns via `inFlightRef`.
- Closing an editor with unsaved edits shows `UnsavedChangesDialog` (save and close / discard / keep editing).
- Campaigns record `source_template_id/_name/_copied_at` and show a "Copied from template" note; they are one-off copies.
- Scheduled campaigns whose stored HTML no longer matches current branding show "Update to current branding" in the list. `handleSend` never sends if the pre-send save failed.
