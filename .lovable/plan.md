## Goal

Turn the Cancellation Policy into a clean **table** (matching the attached design) that lives as its own reusable block. It is defined **once globally in System Settings**, can be **overridden per tour**, and always appears as the **first item in the Additional Information section** of both the Guest Document and the email additional-info blocks.

## Data model

**Global default** — new row in `general_settings`:
- `cancellation_policy` → JSON: `{ "title": "Cancellation Policy", "rows": [{ "notice": "180+ days prior to departure", "refund": "Full refund, less 10% administration fee" }, { "notice": "90–179 days prior to departure", "refund": "50% refund of all payments made" }, { "notice": "Within 90 days of departure", "refund": "No refund available" }] }`

**Per-tour override** — two new columns on `tours`:
- `cancellation_policy_override` (jsonb, nullable) — when set, replaces the global rows for that tour; when null, the tour uses the global policy.
- `cancellation_policy_enabled` (boolean, default true) — toggle to include/exclude the block for that tour.

No new tables, so no new RLS needed (existing `tours`/`general_settings` policies apply).

## UI

**System Settings** — new "Cancellation Policy" card:
- Edit the table title.
- Structured rows editor: add / edit / remove rows, each with **Notice Period** and **Refund** columns.
- Live table preview styled like the attachment (navy header, zebra rows using brand tokens).

**Tour → Additional Information tab** — pinned card at the very top:
- Shows the effective policy as a table.
- Toggle: "Use global policy" vs "Customise for this tour" (reveals the same rows editor).
- Visibility toggle (maps to `cancellation_policy_enabled`).

## Rendering (shared table HTML)

A single table-builder produces consistent HTML (navy `#0a1929` header from `theme_primary_color`, zebra rows, gold not required). Applied in:

1. **`generate-itinerary-document`** edge function — fetch the tour override + global setting, render the table as the **first block** under the "Additional Information" heading, before existing sections.
2. **`send-booking-confirmation`** edge function — when `{{additional_info_blocks}}` is present and the tour has the policy enabled, prepend the cancellation-policy table as the first block (independent of per-rule selection, since it is a standing policy).

## Technical notes

- Australian formatting/terminology and existing brand color tokens are respected; navy pulled from `theme_primary_color` exactly as the document generator already does.
- Both edge functions get redeployed automatically.
- Falls back gracefully to the global policy (and to hard-coded defaults) if a setting is missing.
