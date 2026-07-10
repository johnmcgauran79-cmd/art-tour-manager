// Pure, dependency-free logic for the Xero MCP tools.
// No external imports so it can be unit-tested directly under Deno.

export type XeroErrorCode =
  | "UNAUTHENTICATED"
  | "FINANCIAL_ACCESS_DENIED"
  | "BOOKING_ACCESS_DENIED"
  | "TOUR_ACCESS_DENIED"
  | "XERO_NOT_CONNECTED"
  | "XERO_TOKEN_REFRESH_FAILED"
  | "XERO_RATE_LIMITED"
  | "XERO_INVOICE_NOT_FOUND"
  | "INVALID_INPUT"
  | "STALE_MAPPING_DATA"
  | "INTERNAL_ERROR";

// Roles permitted to use any Xero financial MCP tool (Phase 2).
export const FINANCIAL_ROLES = ["admin", "manager"] as const;

export function isFinancialRole(roles: string[]): boolean {
  return roles.some((r) => (FINANCIAL_ROLES as readonly string[]).includes(r));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

// Human-safe, non-leaking messages per error code. Never contains tokens,
// secrets, headers or raw Xero payloads.
export function safeErrorMessage(code: XeroErrorCode, detail?: string): string {
  const base: Record<XeroErrorCode, string> = {
    UNAUTHENTICATED: "You must be signed in to use this tool.",
    FINANCIAL_ACCESS_DENIED:
      "Your role does not have access to Xero financial data. This is restricted to admin and manager users.",
    BOOKING_ACCESS_DENIED: "You do not have access to this booking.",
    TOUR_ACCESS_DENIED: "You do not have access to this tour.",
    XERO_NOT_CONNECTED: "The Xero integration is not connected.",
    XERO_TOKEN_REFRESH_FAILED:
      "Could not refresh the Xero connection. Please reconnect Xero.",
    XERO_RATE_LIMITED:
      "Xero rate limit reached. Please try again in a few moments.",
    XERO_INVOICE_NOT_FOUND: "No matching Xero invoice was found.",
    INVALID_INPUT: "The request input was invalid.",
    STALE_MAPPING_DATA:
      "Only cached mapping data was available; it may be out of date.",
    INTERNAL_ERROR: "An unexpected error occurred.",
  };
  // Only allow a short, caller-supplied clarification (never Xero payloads).
  const suffix = detail ? ` ${detail}` : "";
  return base[code] + suffix;
}

// Consider a mapping "stale" if it hasn't been updated within the threshold.
export function computeStaleWarning(
  updatedAt: string | null | undefined,
  now: number = Date.now(),
  thresholdMs: number = 24 * 60 * 60 * 1000,
): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return true;
  return now - t > thresholdMs;
}

// ---- Booking status inference (read-only port of xero-webhook logic) ----
// NOTE: This duplicates status-mapping logic from supabase/functions/xero-webhook.
// Tracked as tech debt; the production function is intentionally left untouched
// for now. A future refactor should extract a single shared module.
export const STATUS_ORDER: Record<string, number> = {
  invoiced: 1,
  racing_breaks_invoice: 1,
  deposited: 2,
  instalment_paid: 3,
  fully_paid: 4,
};

export function mapXeroStatusToBookingStatus(
  xeroStatus: string,
  amountDue: number,
  amountPaid: number,
  instalmentRequired: boolean,
  currentStatus: string | null,
  passengerCount = 1,
  depositPerPerson = 0,
): string | null {
  let proposed: string | null = null;

  if (xeroStatus === "PAID" || (amountDue === 0 && amountPaid > 0)) {
    proposed = "fully_paid";
  } else if (amountPaid > 0 && amountDue > 0) {
    const totalDepositThreshold = passengerCount * depositPerPerson;
    if (
      instalmentRequired &&
      currentStatus === "deposited" &&
      totalDepositThreshold > 0 &&
      amountPaid > totalDepositThreshold
    ) {
      proposed = "instalment_paid";
    } else {
      proposed = "deposited";
    }
  } else if (xeroStatus === "AUTHORISED" && amountPaid === 0) {
    proposed = "invoiced";
  }

  if (!proposed) return null;

  const currentOrder = STATUS_ORDER[currentStatus || ""] || 0;
  const proposedOrder = STATUS_ORDER[proposed] || 0;
  if (proposedOrder <= currentOrder) return null; // never downgrade
  return proposed;
}

// ---- Invoice normalisation (redact to only the fields we surface) ----
function xeroDate(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (!v) continue;
    // Xero "/Date(1234567890000+0000)/" form
    const m = /\/Date\((\d+)/.exec(v);
    if (m) return new Date(Number(m[1])).toISOString().split("T")[0];
    // ISO or date string
    const iso = v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  return null;
}

export interface NormalizedInvoice {
  xero_invoice_id: string;
  invoice_number: string | null;
  type: string | null;
  contact_name: string | null;
  contact_id: string | null;
  reference: string | null;
  date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  credit_notes_applied: number;
  status: string | null;
}

export function normalizeInvoice(inv: any): NormalizedInvoice {
  const creditNotes = Array.isArray(inv?.CreditNotes)
    ? inv.CreditNotes.reduce(
        (s: number, c: any) => s + (Number(c?.AppliedAmount) || 0),
        0,
      )
    : 0;
  return {
    xero_invoice_id: inv?.InvoiceID ?? "",
    invoice_number: inv?.InvoiceNumber ?? null,
    type: inv?.Type ?? null,
    contact_name: inv?.Contact?.Name ?? null,
    contact_id: inv?.Contact?.ContactID ?? null,
    reference: inv?.Reference ?? null,
    date: xeroDate(inv?.DateString, inv?.Date),
    due_date: xeroDate(inv?.DueDateString, inv?.DueDate),
    currency: inv?.CurrencyCode ?? null,
    subtotal: Number(inv?.SubTotal) || 0,
    tax: Number(inv?.TotalTax) || 0,
    total: Number(inv?.Total) || 0,
    amount_paid: Number(inv?.AmountPaid) || 0,
    amount_due: Number(inv?.AmountDue) || 0,
    credit_notes_applied: creditNotes,
    status: inv?.Status ?? null,
  };
}

export interface NormalizedPayment {
  payment_id: string | null;
  date: string | null;
  amount: number;
  reference: string | null;
}

export function normalizePayments(inv: any): NormalizedPayment[] {
  if (!Array.isArray(inv?.Payments)) return [];
  return inv.Payments.map((p: any) => ({
    payment_id: p?.PaymentID ?? null,
    date: xeroDate(p?.DateString, p?.Date),
    amount: Number(p?.Amount) || 0,
    reference: p?.Reference ?? null,
  }));
}

export function normalizeLineItems(inv: any): any[] {
  if (!Array.isArray(inv?.LineItems)) return [];
  return inv.LineItems.map((li: any) => ({
    description: li?.Description ?? null,
    quantity: Number(li?.Quantity) || 0,
    unit_amount: Number(li?.UnitAmount) || 0,
    line_amount: Number(li?.LineAmount) || 0,
    tax_amount: Number(li?.TaxAmount) || 0,
    account_code: li?.AccountCode ?? null,
  }));
}

export function daysOverdue(dueDate: string | null, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const today = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
  if (Number.isNaN(due)) return 0;
  const diff = Math.floor((today - due) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 0;
}

// Pick the least-progressed (lowest order) proposed status across invoices,
// mirroring the webhook's conservative behaviour.
export function pickLowestProposedStatus(
  proposals: (string | null)[],
): string | null {
  const valid = proposals.filter((p): p is string => !!p);
  if (valid.length === 0) return null;
  return valid.sort(
    (a, b) => (STATUS_ORDER[a] || 0) - (STATUS_ORDER[b] || 0),
  )[0];
}