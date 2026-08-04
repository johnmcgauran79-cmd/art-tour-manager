# Guest Document Itinerary Text — implementation plan

Adds a reusable, tour-agnostic ART AI skill that drafts guest-facing itinerary text for any tour, shows it as an editable staff preview, and (separately, admin/manager only) saves it as an editable Word document into that tour's existing Guest Document slot.

## Workflow being built

1. Tour Details → Itinerary shows a new **Create Guest Document Text** button (hidden for view-only roles).
2. The button calls the existing `art-ai-chat` Edge Function in a new structured skill mode. The server gathers the tour, itinerary, activities, hotels and additional information under the signed-in user's own permissions.
3. The response is validated structured data (day number, date, title, meals, transport, narrative, timings, warnings) and rendered in an editable preview panel.
4. Existing itinerary prose stays the narrative base; activity times are woven in; Transport shows mode only; conflicts, gaps and tentative details appear as review warnings rather than being invented or silently resolved.
5. Generating, regenerating, editing or discarding the preview writes nothing — no ART records, no storage, no website.
6. Admin/manager can then select **Save as Guest Document**, which builds a `.docx` server-side and uploads it into the tour's existing Guest Document slot.
7. If a Guest Document already exists, its exact filename is shown and explicit confirmation is required before replacement.
8. After saving, the preview stays open, the Guest Document field refreshes, and the saved filename with the existing Open/Download action is shown.
9. Nothing in this flow contacts the public Australian Racing Tours website.

## Files that will change

Backend (Supabase Edge Functions):

- `supabase/functions/_shared/guestItinerary.ts` (new) — skill prompt, source-context normaliser and the JSON output schema, ported from the supplied package. Shared by the function and its tests.
- `supabase/functions/art-ai-chat/index.ts` — register `create_guest_document_itinerary`; add a `structured_skill` request mode that returns one validated JSON payload instead of streamed prose; orchestrate the read-only tool calls (`get_tour`, `get_tour_itinerary`, `list_tour_activities`, `list_tour_hotels`, `list_tour_additional_info`) through the existing user-token MCP path; keep the existing auth, rate limiting and `ai_usage` logging. Reuses the existing server date grounding so "today" is never taken from the browser.
- `supabase/functions/generate-guest-document-docx/index.ts` (new) — accepts the reviewed preview, validates it, builds the `.docx`, uploads it to the existing attachments bucket under the tour's guest-documents folder, and updates the Guest Document filename/path on the tour's itinerary record. Admin/manager only; the previous file is only removed after the new one is stored.

Frontend:

- `src/components/TourItineraryTab.tsx` — add the **Create Guest Document Text** action next to the existing Generate Document / Send Itinerary buttons.
- `src/components/itinerary/GuestDocumentTextModal.tsx` (new) — generation state, editable day-by-day preview, review warnings panel, Regenerate / Discard, and the **Save as Guest Document** action with the replace-confirmation step.
- `src/hooks/useGuestItineraryDraft.ts` (new) — calls the skill, holds the draft in local state only, and calls the docx function on save; invalidates the existing `["itinerary", tourId]` query afterwards so the Guest Document field refreshes.

Tests:

- `supabase/functions/_shared/guestItinerary_test.ts` (new) — context normalisation, full date coverage, out-of-range activities, tentative wording, transport-line constraint and schema validation.
- `supabase/functions/art-ai-chat/guest_itinerary_skill_test.ts` (new) — rejects an unknown skill id, rejects a non-UUID tour id, and confirms a user without access to a tour receives an access error rather than data.

## Database and storage

- No schema migration is required. `tour_itineraries.guest_document_file_path` and `guest_document_file_name` already exist and are already surfaced by the Guest Document upload field.
- Files continue to use the existing private `attachments` bucket with signed-URL access, matching the current upload pattern.
- One check during implementation: whether `ai_usage.conversation_id` accepts null. If it does not, the structured skill will log against the caller's existing conversation record rather than requiring a schema change.

## Technical notes

- The skill is registered inside the existing deterministic-skill framework in `art-ai-chat`; no separate assistant, model key or chat surface is introduced.
- Structured output is requested with a strict JSON schema and validated server-side before returning; a malformed model response fails cleanly with a staff-visible error and no partial preview.
- Tour id is treated as untrusted input and UUID-validated; all data reads run under the caller's token so row-level security applies.
- Document generation and upload stay separate operations, so a failed build cannot damage an existing Guest Document.
- No tour names, dates, hotels, activities or wording are hard-coded; South Korea is used only as a manual regression check after approval.
- Edge Function deployment in this project is manual (Supabase CLI), so after approval the code changes land and you deploy `art-ai-chat` and `generate-guest-document-docx` before live validation.
