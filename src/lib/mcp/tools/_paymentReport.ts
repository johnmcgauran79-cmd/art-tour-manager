// Pure, dependency-free payment-exception classification logic.
//
// This module is the SINGLE SOURCE OF TRUTH for payment-exception rules used by
// the Xero reconciliation MCP tools. It is a faithful, verbatim port of the
// rules currently used by the production reporting/UI code:
//   - supabase/functions/generate-payment-status-report/index.ts (weekly email)
//   - src/hooks/usePaymentAlerts.ts
//   - src/pages/operations/PaymentStatus.tsx
//
// TECH DEBT (follow-up, NOT part of this phase): the rules below are still
// duplicated in the four production locations listed above plus
// src/hooks/useBookingQueries.ts. A later task should refactor those callers to
// import this shared classifier so the rules live in exactly one place. The
// production report/UI are intentionally left untouched in this phase; parity
// tests (payment_report_test.ts) prove this module matches their behaviour.

// Bump when the classification rules change. Surfaced as `rules_version`.
export const PAYMENT_RULES_VERSION = "2026-07-10";

// Deterministic priority when a booking satisfies more than one rule.
export type PaymentExceptionType =
  | "missing_deposit"
  | "missing_instalment"
  | "overdue_final_balance";

export const EXCEPTION_PRIORITY: PaymentExceptionType[] = [
  "missing_deposit",
  "missing_instalment",
  "overdue_final_balance",
];

// Statuses that are never counted as a payment exception (mirror of the
// production report's query-level exclusions).
export const EXCLUDED_STATUSES = [
  "cancelled",
  "waitlisted",
  "host",
  "complimentary",
] as const;

// Statuses that satisfy the instalment (i.e. NOT owing an instalment).
export const INSTALMENT_SATISFIED_STATUSES = [
  "instalment_paid",
  "fully_paid",
  "racing_breaks_invoice",
] as const;

export type ExpectedAmountSource =
  | "stored_tour_deposit"
  | "stored_instalment_amount"
  | "derived_base_tour_price"
  | "xero_invoice"
  | "unavailable";

export interface BookingForClassification {
  id: string;
  status: string | null;
  created_at: string; // ISO timestamp
  passenger_count?: number | null;
}

export interface TourForClassification {
  instalment_required?: boolean | null;
  instalment_date?: string | null; // YYYY-MM-DD
  final_payment_date?: string | null; // YYYY-MM-DD
  deposit_required?: number | null;
  instalment_amount?: number | null;
}

export interface ExceptionDetail {
  type: PaymentExceptionType;
  expected_due_date: string | null; // YYYY-MM-DD
  days_overdue: number;
  expected_amount: number | null;
  expected_amount_source: ExpectedAmountSource;
}

export interface ClassificationResult {
  is_exception: boolean;
  primary_exception_type: PaymentExceptionType | null;
  all_applicable_exception_types: PaymentExceptionType[];
  details: Record<PaymentExceptionType, ExceptionDetail | null>;
  classification_explanation: string;
  excluded_reason: string | null; // set when the booking is excluded outright
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysBetween(fromDateOnly: string, asOf: Date): number {
  const from = new Date(fromDateOnly + "T00:00:00Z").getTime();
  const today = new Date(toDateOnly(asOf) + "T00:00:00Z").getTime();
  if (Number.isNaN(from)) return 0;
  const diff = Math.floor((today - from) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

// ---- Individual rule predicates (verbatim port) ----

// Deposit owing: status === 'invoiced' AND created_at is 7+ days before as-of.
// Mirrors: new Date(b.created_at) < (asOf - 7 days).
export function isMissingDeposit(
  booking: BookingForClassification,
  asOf: Date,
): boolean {
  if (booking.status !== "invoiced") return false;
  const cutoff = new Date(asOf.getTime() - 7 * MS_PER_DAY);
  return new Date(booking.created_at) < cutoff;
}

// Instalment owing: tour requires instalment, as-of is past instalment_date,
// and status is not one of the instalment-satisfied statuses.
export function isMissingInstalment(
  booking: BookingForClassification,
  tour: TourForClassification,
  asOf: Date,
): boolean {
  if (!tour.instalment_required || !tour.instalment_date) return false;
  if (asOf <= new Date(tour.instalment_date)) return false;
  return !(INSTALMENT_SATISFIED_STATUSES as readonly string[]).includes(
    booking.status || "",
  );
}

// Final balance overdue: as-of is past final_payment_date and not fully paid.
export function isOverdueFinalBalance(
  booking: BookingForClassification,
  tour: TourForClassification,
  asOf: Date,
): boolean {
  if (!tour.final_payment_date) return false;
  if (asOf <= new Date(tour.final_payment_date)) return false;
  return booking.status !== "fully_paid";
}

function depositDetail(
  booking: BookingForClassification,
  tour: TourForClassification,
  asOf: Date,
): ExceptionDetail {
  const created = new Date(booking.created_at);
  const due = new Date(created.getTime() + 7 * MS_PER_DAY);
  const dueDate = toDateOnly(due);
  const perPerson = Number(tour.deposit_required) || 0;
  const pax = Math.max(Number(booking.passenger_count) || 1, 1);
  const hasDeposit = perPerson > 0;
  return {
    type: "missing_deposit",
    expected_due_date: dueDate,
    days_overdue: daysBetween(dueDate, asOf),
    // deposit_required is stored per-person; passenger_count is a stored value.
    expected_amount: hasDeposit ? perPerson * pax : null,
    expected_amount_source: hasDeposit ? "stored_tour_deposit" : "unavailable",
  };
}

function instalmentDetail(
  tour: TourForClassification,
  asOf: Date,
): ExceptionDetail {
  const dueDate = tour.instalment_date || null;
  // Only tours.instalment_amount is an authoritative stored instalment figure.
  // We NEVER derive it from deposit_required or tour pricing. It is returned
  // as-stored (not multiplied) to avoid an unverified per-person assumption.
  const stored = Number(tour.instalment_amount);
  const hasInstalmentAmount = Number.isFinite(stored) && stored > 0;
  return {
    type: "missing_instalment",
    expected_due_date: dueDate,
    days_overdue: dueDate ? daysBetween(dueDate, asOf) : 0,
    expected_amount: hasInstalmentAmount ? stored : null,
    expected_amount_source: hasInstalmentAmount
      ? "stored_instalment_amount"
      : "unavailable",
  };
}

function finalDetail(tour: TourForClassification, asOf: Date): ExceptionDetail {
  const dueDate = tour.final_payment_date || null;
  // No booking-specific contract total is stored, so an authoritative final
  // balance amount is unavailable. Never derived from tour pricing.
  return {
    type: "overdue_final_balance",
    expected_due_date: dueDate,
    days_overdue: dueDate ? daysBetween(dueDate, asOf) : 0,
    expected_amount: null,
    expected_amount_source: "unavailable",
  };
}

export function isExcludedStatus(status: string | null): boolean {
  return (EXCLUDED_STATUSES as readonly string[]).includes(status || "");
}

/**
 * Classify a single booking against the payment-exception rules for its tour.
 * Returns every applicable exception, the deterministic primary exception and a
 * human-readable explanation. Pure and deterministic given `asOf`.
 */
export function classifyBookingPaymentException(
  booking: BookingForClassification,
  tour: TourForClassification,
  asOf: Date = new Date(),
): ClassificationResult {
  const emptyDetails: Record<PaymentExceptionType, ExceptionDetail | null> = {
    missing_deposit: null,
    missing_instalment: null,
    overdue_final_balance: null,
  };

  if (isExcludedStatus(booking.status)) {
    return {
      is_exception: false,
      primary_exception_type: null,
      all_applicable_exception_types: [],
      details: emptyDetails,
      classification_explanation: `Booking status "${booking.status}" is excluded from payment-exception reporting.`,
      excluded_reason: `status_${booking.status}`,
    };
  }

  const applicable: PaymentExceptionType[] = [];
  const details = { ...emptyDetails };

  if (isMissingDeposit(booking, asOf)) {
    applicable.push("missing_deposit");
    details.missing_deposit = depositDetail(booking, tour, asOf);
  }
  if (isMissingInstalment(booking, tour, asOf)) {
    applicable.push("missing_instalment");
    details.missing_instalment = instalmentDetail(tour, asOf);
  }
  if (isOverdueFinalBalance(booking, tour, asOf)) {
    applicable.push("overdue_final_balance");
    details.overdue_final_balance = finalDetail(tour, asOf);
  }

  // Deterministic primary selection by fixed priority.
  const primary =
    EXCEPTION_PRIORITY.find((t) => applicable.includes(t)) ?? null;

  let explanation: string;
  if (!primary) {
    explanation = "No payment exception applies to this booking as of the report date.";
  } else if (applicable.length === 1) {
    explanation = explainType(primary, details[primary]!);
  } else {
    const secondary = applicable.filter((t) => t !== primary);
    explanation =
      `${explainType(primary, details[primary]!)} ` +
      `This is the primary exception because ${primary} has the highest ` +
      `priority (deposit > instalment > final balance). Also applicable: ` +
      `${secondary.join(", ")}.`;
  }

  return {
    is_exception: applicable.length > 0,
    primary_exception_type: primary,
    all_applicable_exception_types: applicable,
    details,
    classification_explanation: explanation,
    excluded_reason: null,
  };
}

function explainType(type: PaymentExceptionType, d: ExceptionDetail): string {
  switch (type) {
    case "missing_deposit":
      return `Deposit owing: booking is still in "invoiced" status ${d.days_overdue} day(s) past the 7-day deposit window (due ${d.expected_due_date}).`;
    case "missing_instalment":
      return `Instalment owing: the tour requires an instalment and the instalment date (${d.expected_due_date}) has passed without the booking reaching an instalment-satisfied status.`;
    case "overdue_final_balance":
      return `Final balance overdue: the final payment date (${d.expected_due_date}) has passed and the booking is not fully paid.`;
  }
}

/** Map a report_type filter to the exception types it includes. */
export function reportTypeFilter(
  reportType: string,
): PaymentExceptionType[] | null {
  switch (reportType) {
    case "missing_deposits":
      return ["missing_deposit"];
    case "missing_instalments":
      return ["missing_instalment"];
    case "overdue_final_balances":
      return ["overdue_final_balance"];
    case "all_payment_exceptions":
      return ["missing_deposit", "missing_instalment", "overdue_final_balance"];
    default:
      return null;
  }
}