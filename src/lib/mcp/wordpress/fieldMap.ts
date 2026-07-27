// Client mirror of supabase/functions/_shared/wordpressFieldMap.ts.
// Keep both files in lockstep.

export type ArtScalar = string | number | boolean | null | undefined;

export interface FieldMapEntry {
  artKey: string;
  wpKey: string;
  label: string;
  kind: "text" | "number" | "date" | "html";
  toWp: (v: ArtScalar) => string;
  fromWp: (v: unknown) => string;
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toWpDate(v: ArtScalar): string {
  const s = asStr(v).trim();
  if (!s) return "";
  const digits = s.replace(/\D+/g, "");
  return digits.length === 8 ? digits : s;
}

function normalizeNumber(v: string): string {
  const s = v.replace(/[^\d.\-]/g, "").trim();
  if (s === "" || s === "-" || s === ".") return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}
function normalizeDate(v: string): string { return v.replace(/\D+/g, ""); }
function normalizeText(v: string): string { return v.replace(/\s+/g, " ").trim().toLowerCase(); }
function normalizeHtml(v: string): string {
  return v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
export function semanticEqual(kind: FieldMapEntry["kind"], a: string, b: string): boolean {
  switch (kind) {
    case "number": return normalizeNumber(a) === normalizeNumber(b);
    case "date":   return normalizeDate(a) === normalizeDate(b);
    case "html":   return normalizeHtml(a) === normalizeHtml(b);
    default:       return normalizeText(a) === normalizeText(b);
  }
}

export const TOUR_FIELD_MAP: FieldMapEntry[] = [
  { artKey: "price_single", wpKey: "single_room_price", label: "Single room price", kind: "number", toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)), fromWp: asStr },
  { artKey: "price_twin", wpKey: "twin_room_per_person_price", label: "Twin room (per person)", kind: "number", toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)), fromWp: asStr },
  { artKey: "price_double", wpKey: "double_room_per_person_price", label: "Double room (per person)", kind: "number", toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)), fromWp: asStr },
  { artKey: "start_date", wpKey: "start_date", label: "Start date", kind: "date", toWp: toWpDate, fromWp: asStr },
  { artKey: "end_date", wpKey: "end_date", label: "End date", kind: "date", toWp: toWpDate, fromWp: asStr },
  { artKey: "location", wpKey: "location", label: "Location", kind: "text", toWp: asStr, fromWp: asStr },
  { artKey: "capacity", wpKey: "capacity", label: "Capacity", kind: "number", toWp: (v) => (v === null || v === undefined || v === "" ? "" : String(v)), fromWp: asStr },
  { artKey: "instalment_details", wpKey: "payment_details", label: "Payment details", kind: "html", toWp: asStr, fromWp: asStr },
];