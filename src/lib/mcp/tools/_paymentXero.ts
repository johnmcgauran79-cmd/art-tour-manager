// Xero-dependent helpers for the reconciliation tools. Everything here runs
// server-side only (service-role Xero access) and NEVER returns tokens, secrets
// or raw Xero payloads — only redacted, normalised fields.
import { getXeroAuth, fetchInvoiceById, type XeroAuth } from "./_xero";
import {
  computeStaleWarning,
  normalizeInvoice,
  type NormalizedInvoice,
} from "./_xeroLogic";
import {
  createInvoiceFetchContext,
  cachedInvoiceFetch,
  type InvoiceFetchContext,
  type FetchContextMetrics,
} from "./_xeroHttp";

// A request-scoped cache of normalised invoice fetch results. Keyed by Xero
// InvoiceID; lives only for one MCP tool invocation. Stores the tool-facing
// result (ok/data/code) only — never tokens or raw Xero payloads.
export type XeroInvoiceResult = { ok: boolean; data?: any; code?: string };
export type XeroFetchContext = InvoiceFetchContext<XeroInvoiceResult>;
export type { FetchContextMetrics };

/** Create a fresh request-scoped invoice cache for a single tool invocation. */
export function createXeroFetchContext(): XeroFetchContext {
  return createInvoiceFetchContext<XeroInvoiceResult>();
}

/**
 * Fetch an invoice through the request-scoped cache: at most one live Xero call
 * per InvoiceID per invocation, even across bookings. Retry counts consumed by
 * the underlying request are folded into the context metrics.
 */
export async function fetchInvoiceCached(
  fctx: XeroFetchContext,
  auth: XeroAuth,
  invoiceId: string,
): Promise<XeroInvoiceResult> {
  return cachedInvoiceFetch(fctx, invoiceId, async (id) => {
    const metrics = { retry_count: 0 };
    const result = await fetchInvoiceById(auth, id, { metrics });
    return { result, retryCount: metrics.retry_count };
  });
}

// Xero invoice statuses that must be EXCLUDED from an active balance.
const INACTIVE_INVOICE_STATUSES = ["VOIDED", "DELETED"];

export interface MappingRow {
  xero_invoice_id: string | null;
  xero_invoice_number: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  total_amount: number | null;
  xero_status: string | null;
  updated_at: string | null;
  booking_id?: string | null;
}

export type MoneySource = "live_xero" | "xero_mapping_cache" | "unavailable";

export interface DuplicateLinkFinding {
  duplicate_type:
    | "same_invoice_mapped_twice_same_booking"
    | "duplicate_mapping_rows";
  affected_invoice_id: string;
  affected_booking_ids: string[];
  mapping_count: number;
}

/**
 * Informational finding: one Xero invoice is intentionally linked to several
 * bookings (shared/group/couple invoices). This is a supported, legitimate
 * configuration and is NOT a discrepancy.
 */
export interface SharedInvoiceLink {
  finding_type: "shared_invoice_across_bookings";
  xero_invoice_id: string;
  invoice_number: string | null;
  booking_ids: string[];
  booking_count: number;
}

export interface BookingXeroPosition {
  invoices: NormalizedInvoice[]; // active invoices (live where available)
  invoice_summaries: {
    xero_invoice_id: string | null;
    invoice_number: string | null;
    status: string | null;
    total: number;
    amount_paid: number;
    amount_due: number;
    due_date: string | null;
    is_active: boolean;
    data_source: MoneySource;
  }[];
  linked_invoice_numbers: string[];
  received_amount: number | null;
  received_amount_source: MoneySource;
  outstanding_amount: number | null;
  outstanding_amount_source: MoneySource;
  active_invoice_count: number;
  // null when it cannot be determined confidently (no active invoices or all
  // amounts came from stale cache). A booking is only "Xero fully paid" when
  // every active linked invoice has no amount due.
  xero_fully_paid: boolean | null;
  data_source: MoneySource | "mixed";
  live_verification_completed: boolean;
  partial_results: boolean;
  stale_warning: boolean;
  duplicate_link: DuplicateLinkFinding | null;
}

/** Detect duplicate mapping conditions for a single booking's mapping rows. */
export function detectBookingDuplicate(
  bookingId: string,
  rows: MappingRow[],
): DuplicateLinkFinding | null {
  const byInvoice = new Map<string, number>();
  for (const r of rows) {
    if (!r.xero_invoice_id) continue;
    byInvoice.set(r.xero_invoice_id, (byInvoice.get(r.xero_invoice_id) || 0) + 1);
  }
  for (const [invId, count] of byInvoice) {
    if (count > 1) {
      return {
        duplicate_type: "same_invoice_mapped_twice_same_booking",
        affected_invoice_id: invId,
        affected_booking_ids: [bookingId],
        mapping_count: count,
      };
    }
  }
  return null;
}

/**
 * Summarise a booking's Xero position from its mapping rows, refreshing each
 * invoice against live Xero where possible. Multiple DISTINCT invoices per
 * booking are expected and NOT treated as duplicates. Voided/deleted invoices
 * are excluded from the active balance.
 */
export async function summarizeBookingXero(
  auth: Awaited<ReturnType<typeof getXeroAuth>>,
  bookingId: string,
  rows: MappingRow[],
  now: number = Date.now(),
  fctx?: XeroFetchContext,
): Promise<BookingXeroPosition> {
  // Use a shared request-scoped cache when provided; otherwise create a local
  // one so a single booking still de-duplicates its own repeated InvoiceIDs.
  const fc = fctx ?? createXeroFetchContext();
  const linkedNumbers = Array.from(
    new Set(rows.map((r) => r.xero_invoice_number).filter(Boolean) as string[]),
  );
  const duplicate = detectBookingDuplicate(bookingId, rows);

  // De-duplicate mapping rows by invoice id for balance math.
  const unique = Array.from(
    new Map(rows.filter((r) => r.xero_invoice_id).map((r) => [r.xero_invoice_id, r])).values(),
  );

  const summaries: BookingXeroPosition["invoice_summaries"] = [];
  const activeInvoices: NormalizedInvoice[] = [];
  let anyLive = false;
  let anyCache = false;
  let liveAllOk = true;
  let stale = false;

  for (const m of unique) {
    let total = Number(m.total_amount) || 0;
    let paid = Number(m.amount_paid) || 0;
    let due = Number(m.amount_due) || 0;
    let status = m.xero_status || null;
    let dueDate: string | null = null;
    let source: MoneySource = "xero_mapping_cache";
    let normalized: NormalizedInvoice | null = null;

    if (auth.ok && m.xero_invoice_id) {
      const live = await fetchInvoiceCached(fc, auth.data as XeroAuth, m.xero_invoice_id);
      if (live.ok) {
        anyLive = true;
        normalized = normalizeInvoice(live.data);
        total = normalized.total;
        paid = normalized.amount_paid;
        due = normalized.amount_due;
        status = normalized.status;
        dueDate = normalized.due_date;
        source = "live_xero";
      } else {
        liveAllOk = false;
        anyCache = true;
        stale = stale || computeStaleWarning(m.updated_at, now);
      }
    } else {
      liveAllOk = false;
      anyCache = true;
      stale = stale || computeStaleWarning(m.updated_at, now);
    }

    const isActive = !INACTIVE_INVOICE_STATUSES.includes(
      (status || "").toUpperCase(),
    );
    summaries.push({
      xero_invoice_id: m.xero_invoice_id,
      invoice_number: m.xero_invoice_number,
      status,
      total,
      amount_paid: paid,
      amount_due: due,
      due_date: dueDate,
      is_active: isActive,
      data_source: source,
    });
    if (isActive && normalized) activeInvoices.push(normalized);
  }

  const activeSummaries = summaries.filter((s) => s.is_active);
  const haveAnyMoney = summaries.length > 0;
  const moneySource: MoneySource =
    !haveAnyMoney
      ? "unavailable"
      : anyLive && !anyCache
        ? "live_xero"
        : anyCache && !anyLive
          ? "xero_mapping_cache"
          : anyLive && anyCache
            ? "live_xero" // mixed; downgraded via partial flag below
            : "unavailable";

  const received = haveAnyMoney
    ? activeSummaries.reduce((s, r) => s + (r.amount_paid || 0), 0)
    : null;
  const outstanding = haveAnyMoney
    ? activeSummaries.reduce((s, r) => s + (r.amount_due || 0), 0)
    : null;

  const liveVerificationCompleted = auth.ok && liveAllOk && haveAnyMoney;
  const partial = !liveVerificationCompleted && haveAnyMoney;

  // Only assert fully-paid confidently from complete live verification.
  let xeroFullyPaid: boolean | null = null;
  if (liveVerificationCompleted && activeSummaries.length > 0) {
    xeroFullyPaid = activeSummaries.every((r) => (r.amount_due || 0) <= 0.005);
  }

  return {
    invoices: activeInvoices,
    invoice_summaries: summaries,
    linked_invoice_numbers: linkedNumbers,
    received_amount: received,
    received_amount_source: haveAnyMoney ? moneySource : "unavailable",
    outstanding_amount: outstanding,
    outstanding_amount_source: haveAnyMoney ? moneySource : "unavailable",
    active_invoice_count: activeSummaries.length,
    xero_fully_paid: xeroFullyPaid,
    data_source: anyLive && anyCache ? "mixed" : moneySource,
    live_verification_completed: liveVerificationCompleted,
    partial_results: partial,
    stale_warning: stale,
    duplicate_link: duplicate,
  };
}

/**
 * Detect a single Xero invoice linked to multiple DIFFERENT bookings across a
 * set of mapping rows (tour/report scoped). Shared invoices are legitimate
 * (group/couple bookings), so these are returned as informational findings,
 * NOT as duplicates or discrepancies.
 */
export function detectSharedInvoiceLinks(
  rows: MappingRow[],
): SharedInvoiceLink[] {
  const byInvoice = new Map<string, Set<string>>();
  const numberByInvoice = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.xero_invoice_id || !r.booking_id) continue;
    if (!byInvoice.has(r.xero_invoice_id)) byInvoice.set(r.xero_invoice_id, new Set());
    byInvoice.get(r.xero_invoice_id)!.add(r.booking_id);
    if (!numberByInvoice.has(r.xero_invoice_id)) {
      numberByInvoice.set(r.xero_invoice_id, r.xero_invoice_number ?? null);
    }
  }
  const findings: SharedInvoiceLink[] = [];
  for (const [invId, bookings] of byInvoice) {
    if (bookings.size > 1) {
      findings.push({
        finding_type: "shared_invoice_across_bookings",
        xero_invoice_id: invId,
        invoice_number: numberByInvoice.get(invId) ?? null,
        booking_ids: Array.from(bookings),
        booking_count: bookings.size,
      });
    }
  }
  return findings;
}