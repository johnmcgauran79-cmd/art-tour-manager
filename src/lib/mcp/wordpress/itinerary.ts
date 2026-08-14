// Shared ART -> WordPress itinerary mapping.
// The WordPress tour post type exposes an ACF repeater named `itinerary`
// whose rows are { date_event, details }. `date_event` is a display heading
// such as "WEDNESDAY 16 FEBRUARY 2028 - Ferry Transfer & Welcome Dinner"
// and `details` is HTML prose.
//
// Mirror of supabase/functions/_shared/wordpressItinerary.ts — keep in lockstep.

export const WP_ITINERARY_FIELD = "itinerary";

export interface WpItineraryRow {
  date_event: string;
  details: string;
}

export interface ArtItineraryEntryInput {
  time_slot?: string | null;
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

/** "2028-02-16" -> "WEDNESDAY 16 FEBRUARY 2028" (UTC-safe, no timezone drift). */
export function formatItineraryDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate).trim());
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return "";
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function contentToHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (looksLikeHtml(trimmed)) return trimmed;
  return escapeHtml(trimmed).replace(/\r?\n/g, "<br />");
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

export function buildDayDetailsHtml(day: ArtItineraryDayInput): string {
  const blocks: string[] = [];
  for (const e of sortedEntries(day)) {
    const subject = (e.subject ?? "").trim();
    const time = (e.time_slot ?? "").trim();
    const body = contentToHtml(e.content ?? "");
    const heading = [time, subject].filter(Boolean).join(" – ");
    if (!heading && !body) continue;
    if (heading && body) {
      blocks.push(`<p><strong>${escapeHtml(heading)}</strong><br />${body}</p>`);
    } else if (heading) {
      blocks.push(`<p><strong>${escapeHtml(heading)}</strong></p>`);
    } else {
      blocks.push(`<p>${body}</p>`);
    }
  }
  return blocks.join("\n");
}

/** Render ART itinerary days into WordPress `itinerary` repeater rows. */
export function buildWpItineraryRows(days: ArtItineraryDayInput[]): WpItineraryRow[] {
  return [...(days ?? [])]
    .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
    .map((day) => {
      const datePart = formatItineraryDate(day.activity_date);
      const title = buildDayTitle(day);
      const date_event = [datePart, title].filter(Boolean).join(" - ");
      return { date_event, details: buildDayDetailsHtml(day) };
    })
    .filter((r) => r.date_event || r.details);
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
    };
  });
}

function normaliseHtml(v: string): string {
  return v
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function normaliseText(v: string): string {
  return v.replace(/\s+/g, " ").trim().toLowerCase();
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
        normaliseHtml(art.details) !== normaliseHtml(wp.details);
    if (rowChanged) changed = true;
    rows.push({ index: i, art, wp, changed: rowChanged });
  }
  return { rows, changed };
}
