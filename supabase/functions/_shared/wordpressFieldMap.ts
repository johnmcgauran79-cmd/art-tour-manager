// Shared field map — ART tour columns → WordPress ACF keys.
// Kept in lockstep with src/lib/mcp/wordpress/fieldMap.ts on the client.
// Only Phase-1 headline scalar fields are mapped here. Repeaters
// (inclusions/exclusions/faqs) and hotel/itinerary groups will be
// added as the WP shapes are finalised.

export type ArtScalar = string | number | boolean | null | undefined;

export interface FieldMapEntry {
  /** ART tour column name */
  artKey: string;
  /** WordPress ACF key on the tour post */
  wpKey: string;
  /** Human label shown in the diff dialog */
  label: string;
  /** How the value should be rendered/edited */
  kind: "text" | "number" | "date" | "html";
  /** Convert ART value → WP-side string representation */
  toWp: (v: ArtScalar) => string;
  /** Convert WP value (already a string in ACF) → normalised comparable string */
  fromWp: (v: unknown) => string;
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ACF date fields on this site are stored as ISO-ish "YYYY-MM-DD" strings.
// If the value already looks like a date, pass it through; otherwise leave blank.
function toWpDate(v: ArtScalar): string {
  const s = asStr(v).trim();
  if (!s) return "";
  // Accept YYYY-MM-DD directly. Anything else pass through unchanged.
  return s;
}

export const TOUR_FIELD_MAP: FieldMapEntry[] = [
  {
    artKey: "price_single",
    wpKey: "single_room_price",
    label: "Single room price",
    kind: "number",
    toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)),
    fromWp: asStr,
  },
  {
    artKey: "price_twin",
    wpKey: "twin_room_per_person_price",
    label: "Twin room (per person)",
    kind: "number",
    toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)),
    fromWp: asStr,
  },
  {
    artKey: "price_double",
    wpKey: "double_room_per_person_price",
    label: "Double room (per person)",
    kind: "number",
    toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)),
    fromWp: asStr,
  },
  {
    artKey: "start_date",
    wpKey: "start_date",
    label: "Start date",
    kind: "date",
    toWp: toWpDate,
    fromWp: asStr,
  },
  {
    artKey: "end_date",
    wpKey: "end_date",
    label: "End date",
    kind: "date",
    toWp: toWpDate,
    fromWp: asStr,
  },
  {
    artKey: "location",
    wpKey: "location",
    label: "Location",
    kind: "text",
    toWp: asStr,
    fromWp: asStr,
  },
  {
    artKey: "capacity",
    wpKey: "capacity",
    label: "Capacity",
    kind: "number",
    toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)),
    fromWp: asStr,
  },
  {
    artKey: "instalment_details",
    wpKey: "payment_details",
    label: "Payment details",
    kind: "html",
    toWp: asStr,
    fromWp: asStr,
  },
];

export function buildFieldDiff(
  artRow: Record<string, unknown>,
  wpAcf: Record<string, unknown> | null | undefined,
): Array<{
  artKey: string;
  wpKey: string;
  label: string;
  kind: FieldMapEntry["kind"];
  artValue: string;
  wpValue: string;
  changed: boolean;
}> {
  const acf = (wpAcf ?? {}) as Record<string, unknown>;
  return TOUR_FIELD_MAP.map((f) => {
    const artValue = f.toWp(artRow[f.artKey] as ArtScalar);
    const wpValue = f.fromWp(acf[f.wpKey]);
    return {
      artKey: f.artKey,
      wpKey: f.wpKey,
      label: f.label,
      kind: f.kind,
      artValue,
      wpValue,
      changed: artValue.trim() !== wpValue.trim(),
    };
  });
}