// Shared, dependency-free date grounding + deterministic next-tour selection.
// Pure functions so they can be unit-tested without network/DB access.

export const ORG_TIMEZONE = "Australia/Sydney";

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimezone(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Australian financial year (1 July – 30 June) label for a YYYY-MM-DD date. */
export function financialYear(dateStr: string): string {
  const [y, mo] = dateStr.split("-").map((n) => parseInt(n, 10));
  const fyStart = mo >= 7 ? y : y - 1;
  return `FY${fyStart}-${fyStart + 1}`;
}

export interface DateContext {
  current_date: string;
  current_datetime: string;
  timezone: string;
  current_financial_year: string;
}

/** Authoritative server-side date context in the org timezone. */
export function buildDateContext(now: Date = new Date(), tz: string = ORG_TIMEZONE): DateContext {
  const current_date = todayInTimezone(tz, now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "shortOffset",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const offsetRaw = get("timeZoneName").replace("GMT", "").trim();
  let offset = "+00:00";
  const m = offsetRaw.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (m) offset = `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
  let hour = get("hour");
  if (hour === "24") hour = "00";
  const current_datetime = `${current_date}T${hour}:${get("minute")}:${get("second")}${offset}`;
  return { current_date, current_datetime, timezone: tz, current_financial_year: financialYear(current_date) };
}

export interface CandidateTour {
  id: string;
  name: string;
  start_date: string;
  end_date?: string | null;
  status: string;
  location?: string | null;
  created_at?: string | null;
  is_test_tour?: boolean | null;
}

export interface SelectOpts {
  asOf: string;
  includeTestTours?: boolean;
  includeCancelled?: boolean;
}

/**
 * Deterministically select the next departing tour from a candidate set.
 * Mirrors the DB query filters so it can be unit-tested. Ordering:
 * start_date asc, name asc, created_at asc, id asc.
 */
export function selectNextDepartingTour(
  rows: CandidateTour[],
  opts: SelectOpts,
): CandidateTour | null {
  const excluded = new Set<string>(["archived", ...(opts.includeCancelled ? [] : ["cancelled"])]);
  const filtered = rows.filter((t) => {
    if (t.start_date < opts.asOf) return false;
    if (excluded.has(t.status)) return false;
    if (!opts.includeTestTours && t.is_test_tour) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    const ac = a.created_at ?? "", bc = b.created_at ?? "";
    if (ac !== bc) return ac < bc ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return filtered[0] ?? null;
}
