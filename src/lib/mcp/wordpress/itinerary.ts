// Shared ART -> WordPress itinerary mapping.
// The WordPress tour post type exposes an ACF repeater named `itinerary`
// whose rows are { date_event, details, gallery }. `date_event` is a display
// heading such as "WEDNESDAY 16 FEBRUARY 2028 - Ferry Transfer & Welcome Dinner"
// and `details` is PLAIN TEXT prose with blank lines between paragraphs
// (WordPress applies wpautop when rendering).
//
// Site conventions verified against the live tour posts:
//  - the year appears only on the first and last rows
//  - `details` never repeats the day subject; it is prose only
//  - each row may carry a `gallery` value that must be preserved on push
//
// Mirror of supabase/functions/_shared/wordpressItinerary.ts — keep in lockstep.

export const WP_ITINERARY_FIELD = "itinerary";

export interface WpItineraryRow {
  date_event: string;
  details: string;
  gallery?: unknown;
}

export interface ArtItineraryEntryInput {
  subject?: string | null;
  content?: string | null;
  sort_order?: number | null;
}

export interface ArtItineraryDayInput {
  day_number?: number | null;
  activity_date?: string | null;
  entries?: ArtItineraryEntryInput[] | null;
}

const WEEKDAYS = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/**
 * "2028-02-16" -> "WEDNESDAY 16 FEBRUARY 2028" (UTC-safe, no timezone drift).
 * Pass includeYear=false for "WEDNESDAY 16 FEBRUARY".
 */
export function formatItineraryDate(
  isoDate: string | null | undefined,
  includeYear = true,
): string {
  if (!isoDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate).trim());
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return "";
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return includeYear ? `${base} ${d.getUTCFullYear()}` : base;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** Rich-text HTML -> plain-text paragraphs separated by a blank line (wpautop friendly). */
export function htmlToPlainParagraphs(content: string | null | undefined): string {
  if (!content) return "";
  const withBreaks = String(content)
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(withBreaks)
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim())
    .filter(Boolean)
    .join("\r\n\r\n");
}

function sortedEntries(day: ArtItineraryDayInput): ArtItineraryEntryInput[] {
  return [...(day.entries ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
}

/** Day heading suffix: the day's entry subjects, e.g. "Ferry Transfer & Welcome Dinner". */
export function buildDayTitle(day: ArtItineraryDayInput, maxParts = 3): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const e of sortedEntries(day)) {
    const s = (e.subject ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(s);
    if (parts.length >= maxParts) break;
  }
  return parts.join(" & ");
}

/** Prose for a day: entry content only, no subject/time headings. */
export function buildDayDetails(day: ArtItineraryDayInput): string {
  return sortedEntries(day)
    .map((e) => htmlToPlainParagraphs(e.content))
    .filter(Boolean)
    .join("\r\n\r\n");
}

/** Render ART itinerary days into WordPress `itinerary` repeater rows. */
export function buildWpItineraryRows(days: ArtItineraryDayInput[]): WpItineraryRow[] {
  const ordered = [...(days ?? [])].sort(
    (a, b) => (a.day_number ?? 0) - (b.day_number ?? 0),
  );
  return ordered
    .map((day, i) => {
      const isEdge = i === 0 || i === ordered.length - 1;
      const datePart = formatItineraryDate(day.activity_date, isEdge);
      const title = buildDayTitle(day);
      const date_event = [datePart, title].filter(Boolean).join(" - ");
      return { date_event, details: buildDayDetails(day) };
    })
    .filter((r) => r.date_event || r.details);
}

/** Carry each live row's `gallery` value across to the matching new row by index. */
export function preserveGalleries(
  artRows: WpItineraryRow[],
  wpRows: WpItineraryRow[],
): WpItineraryRow[] {
  return artRows.map((row, i) => {
    const gallery = wpRows[i]?.gallery;
    return gallery === undefined ? { ...row } : { ...row, gallery };
  });
}

/** Coerce whatever WordPress returned for the repeater into rows. */
export function normaliseWpItineraryRows(value: unknown): WpItineraryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!row || typeof row !== "object") return { date_event: "", details: "" };
    const r = row as Record<string, unknown>;
    return {
      date_event: r.date_event === null || r.date_event === undefined ? "" : String(r.date_event),
      details: r.details === null || r.details === undefined ? "" : String(r.details),
      gallery: r.gallery,
    };
  });
}

function normaliseProse(v: string): string {
  return v
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function normaliseText(v: string): string {
  return v.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

export interface ItineraryDiffRow {
  index: number;
  art: WpItineraryRow | null;
  wp: WpItineraryRow | null;
  changed: boolean;
}

/** Row-by-row comparison between the ART-rendered rows and current WP rows. */
export function buildItineraryDiff(
  artRows: WpItineraryRow[],
  wpRows: WpItineraryRow[],
): { rows: ItineraryDiffRow[]; changed: boolean } {
  const len = Math.max(artRows.length, wpRows.length);
  const rows: ItineraryDiffRow[] = [];
  let changed = false;
  for (let i = 0; i < len; i++) {
    const art = artRows[i] ?? null;
    const wp = wpRows[i] ?? null;
    const rowChanged = !art || !wp
      ? true
      : normaliseText(art.date_event) !== normaliseText(wp.date_event) ||
        normaliseProse(art.details) !== normaliseProse(wp.details);
    if (rowChanged) changed = true;
    rows.push({ index: i, art, wp, changed: rowChanged });
  }
  return { rows, changed };
}
