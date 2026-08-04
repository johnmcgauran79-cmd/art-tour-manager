// Date and clock-time primitives shared by the Guest Document itinerary skill.
// Kept in its own module so both the draft validator and the timing reconciler
// can use them without a circular import.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export const pad = (n: number) => String(n).padStart(2, "0");

/** Single clock time, e.g. 9:15am, 9am, 09:15, 17:05, 17:30:00. */
const SINGLE_TIME_RE = /^(\d{1,2})(?::([0-5]\d))?(?::[0-5]\d)?\s*(am|pm|a\.m\.|p\.m\.)?$/i;
/** Range separators the model realistically produces. */
const RANGE_SPLIT_RE = /\s*(?:to|until|till|-|–|—)\s*/i;

export function normaliseSingleTime(value: string): string | null {
  const m = value.trim().match(SINGLE_TIME_RE);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ?? "00";
  const meridiem = m[3]?.toLowerCase().replace(/\./g, "");
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    return `${hour}:${minute}${meridiem}`;
  }
  // 24-hour input — convert to the house style.
  if (hour < 0 || hour > 23) return null;
  const suffix = hour < 12 ? "am" : "pm";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute}${suffix}`;
}

/**
 * Best-effort coercion of a supplied date to yyyy-MM-dd. Returns null when the
 * value cannot be understood at all.
 */
export function coerceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (DATE_RE.test(raw)) return raw;
  const loose = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (loose) return `${loose[1]}-${loose[2].padStart(2, "0")}-${loose[3].padStart(2, "0")}`;
  // "2 September 2026" / "2 Sep 2026" / "Wednesday, 2 September 2026"
  const dmy = raw.replace(/^[A-Za-z]+,\s*/, "").match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    if (month) return `${dmy[3]}-${pad(month)}-${pad(parseInt(dmy[1], 10))}`;
  }
  // "September 2, 2026"
  const mdy = raw.replace(/^[A-Za-z]+,\s*/, "").match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    if (month) return `${mdy[3]}-${pad(month)}-${pad(parseInt(mdy[2], 10))}`;
  }
  // Australian d/m/yyyy — never US m/d/yyyy.
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${pad(parseInt(slash[2], 10))}-${pad(parseInt(slash[1], 10))}`;
  return null;
}

/**
 * Normalise a supplied time or time range to house style
 * (9:15am / 9:30am to 11:40am). Returns null when it is not a time at all.
 */
export function normaliseTimeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  // A date masquerading as a time is never acceptable.
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(raw) || coerceDate(raw)) return null;
  const parts = raw.split(RANGE_SPLIT_RE).filter(Boolean);
  if (parts.length === 1) return normaliseSingleTime(parts[0]);
  if (parts.length === 2) {
    let [from, to] = parts;
    const toNorm = normaliseSingleTime(to);
    // "9:30 to 11:40am" — borrow the meridiem from the end of the range.
    if (toNorm && !/am|pm/i.test(from)) {
      const meridiem = toNorm.endsWith("pm") ? "pm" : "am";
      if (/^\d{1,2}(:[0-5]\d)?$/.test(from.trim()) && parseInt(from, 10) <= 12) {
        from = `${from.trim()}${meridiem}`;
      }
    }
    const fromNorm = normaliseSingleTime(from);
    if (fromNorm && toNorm) return `${fromNorm} to ${toNorm}`;
  }
  return null;
}

/** Date for a 1-based day number relative to the tour start date. */
export function dateForDayNumber(startDate: string, dayNumber: unknown): string | null {
  const n = typeof dayNumber === "number" ? dayNumber : Number(dayNumber);
  if (!Number.isFinite(n) || n < 1) return null;
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(n) - 1);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of yyyy-MM-dd dates between two dates. */
export function dateRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Every clock time mentioned in free text, normalised to house style.
 * Used to prove that a confirmed Activity time really appears in the prose.
 */
export function extractClockTimes(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];
  // Remove ISO dates so 2026-09-02 never reads as 09:02.
  const cleaned = text.replace(/\d{4}-\d{2}-\d{2}/g, " ");
  const found = new Set<string>();
  const withMeridiem = /\b(\d{1,2})(?:[:.]([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)/gi;
  let m: RegExpExecArray | null;
  while ((m = withMeridiem.exec(cleaned))) {
    const norm = normaliseSingleTime(`${m[1]}:${m[2] ?? "00"}${m[3].replace(/\./g, "")}`);
    if (norm) found.add(norm);
  }
  const twentyFour = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:am|pm|a\.m\.|p\.m\.))/gi;
  while ((m = twentyFour.exec(cleaned))) {
    const norm = normaliseSingleTime(`${m[1]}:${m[2]}`);
    if (norm) found.add(norm);
  }
  return [...found];
}
