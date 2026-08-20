// WordPress -> ART coercion helpers used by the reconciliation flow.
// Pushing ART -> WP is handled by wordpressFieldMap.ts; this file is the
// reverse direction: turning display-formatted website values back into
// values that are safe to write into the `tours` table.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Coerce a website date value ("20280216", "16 February 2028", "2028-02-16") to yyyy-MM-dd. */
export function coerceWpDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const digits = s.replace(/\D+/g, "");
  if (digits.length === 8) {
    // ACF date picker default is Ymd
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // "WEDNESDAY 16 FEBRUARY 2028" / "16 Feb 2028" / "February 16, 2028"
  const dmy = /(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/.exec(s);
  if (dmy) {
    const m = MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    if (m) return `${dmy[3]}-${String(m).padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const mdy = /([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (mdy) {
    const m = MONTHS[mdy[1].slice(0, 3).toLowerCase()];
    if (m) return `${mdy[3]}-${String(m).padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  return null;
}

/** "$5,995.00" -> 5995 */
export function coerceWpNumber(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[^\d.\-]/g, "").trim();
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface PullCoercion {
  /** Value to write into the tours row, or undefined when it must be skipped. */
  value?: string | number | null;
  warning?: string;
}

/**
 * Coerce one website field value into an ART column value.
 * `integer` is used for whole-number columns such as capacity.
 */
export function coerceForArt(
  kind: "text" | "number" | "date" | "html",
  label: string,
  raw: unknown,
  opts: { integer?: boolean } = {},
): PullCoercion {
  const rawStr = String(raw ?? "").trim();

  if (kind === "date") {
    if (!rawStr) return { value: null };
    const d = coerceWpDate(rawStr);
    if (!d) return { warning: `${label}: couldn't read the website date "${rawStr}" — left unchanged in ART` };
    return { value: d };
  }

  if (kind === "number") {
    if (!rawStr) return { value: null };
    const n = coerceWpNumber(rawStr);
    if (n === null) return { warning: `${label}: couldn't read the website value "${rawStr}" as a number — left unchanged in ART` };
    return { value: opts.integer ? Math.round(n) : n };
  }

  // text / html
  return { value: rawStr === "" ? null : rawStr };
}

/** Columns that must be whole numbers in ART. */
export const INTEGER_ART_KEYS = new Set(["capacity", "days", "nights", "minimum_passengers_required"]);

/**
 * Split a WordPress itinerary heading into its date and title parts.
 * "WEDNESDAY 16 FEBRUARY 2028 - Ferry Transfer" -> { date: "2028-02-16", title: "Ferry Transfer" }
 */
export function parseItineraryHeading(
  dateEvent: string,
  fallbackYear: string | null,
): { date: string | null; title: string } {
  const s = String(dateEvent ?? "").trim();
  if (!s) return { date: null, title: "" };
  const parts = s.split(/\s+[-–—]\s+/);
  const datePart = parts[0] ?? "";
  const title = parts.slice(1).join(" - ").trim();
  let date = coerceWpDate(datePart);
  if (!date && fallbackYear && /^\d{4}$/.test(fallbackYear)) {
    date = coerceWpDate(`${datePart} ${fallbackYear}`);
  }
  return { date, title };
}

/** Plain-text website prose -> simple HTML paragraphs for the ART rich-text editor. */
export function proseToHtml(details: string | null | undefined): string {
  const s = String(details ?? "").replace(/\r\n/g, "\n").trim();
  if (!s) return "";
  if (/<\s*(p|div|ul|ol|br)\b/i.test(s)) return s;
  return s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** Add days to a yyyy-MM-dd date without timezone drift. */
export function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
