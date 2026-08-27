// Mirror of supabase/functions/_shared/wordpressEditableFields.ts for the
// MCP tool bundled from src/. Keep the two files in lockstep.

export const EDITABLE_ACF_SCALAR_FIELDS = [
  "price",
  "status",
  "radio_book_now",
  "start_date",
  "end_date",
  "time_frame",
  "location",
  "single_room_price",
  "twin_room_per_person_price",
  "double_room_per_person_price",
  "payment_details",
  "add_download_brochure",
  "attach_brochure_here",
] as const;

export const EDITABLE_ACF_REPEATER_FIELDS = [
  "itinerary",
  "inclusions",
  "exclusions_details",
  "faqs_list",
  "add_review",
] as const;

export type EditableAcfScalar = (typeof EDITABLE_ACF_SCALAR_FIELDS)[number];
export type EditableAcfRepeater = (typeof EDITABLE_ACF_REPEATER_FIELDS)[number];

export function sanitiseAcfUpdate(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  const src = input as Record<string, unknown>;
  for (const key of EDITABLE_ACF_SCALAR_FIELDS) {
    if (key in src) {
      let v = src[key];
      if (key === "attach_brochure_here") {
        if (v === "" || v === null || v === undefined) {
          v = null;
        } else if (typeof v === "string" && /^\d+$/.test(v)) {
          v = Number(v);
        } else if (typeof v === "object" && v && "id" in (v as Record<string, unknown>)) {
          const idVal = (v as Record<string, unknown>).id;
          v = typeof idVal === "number" ? idVal : Number(idVal);
        }
      }
      out[key] = v;
    }
  }
  for (const key of EDITABLE_ACF_REPEATER_FIELDS) {
    if (key in src) {
      const v = src[key];
      out[key] = Array.isArray(v) ? v : [];
    }
  }
  return out;
}