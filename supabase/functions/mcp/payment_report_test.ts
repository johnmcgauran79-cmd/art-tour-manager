import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyBookingPaymentException,
  isMissingDeposit,
  isMissingInstalment,
  isOverdueFinalBalance,
  reportTypeFilter,
  PAYMENT_RULES_VERSION,
} from "../../../src/lib/mcp/tools/_paymentReport.ts";
import {
  detectBookingDuplicate,
  detectCrossBookingDuplicates,
  summarizeBookingXero,
  type MappingRow,
} from "../../../src/lib/mcp/tools/_paymentXero.ts";

const asOf = new Date("2026-07-10T00:00:00Z");

// Verbatim re-implementation of the production report rules (from
// generate-payment-status-report/index.ts) to prove parity.
function refDeposit(status: string, createdAt: string, now: Date) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return status === "invoiced" && new Date(createdAt) < cutoff;
}
function refInstalment(status: string, tour: any, now: Date) {
  if (!tour.instalment_required || !tour.instalment_date) return false;
  if (now <= new Date(tour.instalment_date)) return false;
  return status !== "instalment_paid" && status !== "fully_paid" && status !== "racing_breaks_invoice";
}
function refFinal(status: string, tour: any, now: Date) {
  if (!tour.final_payment_date) return false;
  if (now <= new Date(tour.final_payment_date)) return false;
  return status !== "fully_paid";
}

// ---- Parity: deposit ----
Deno.test("parity: deposit classification matches production rule", () => {
  const cases = [
    { status: "invoiced", created: "2026-06-01T00:00:00Z" }, // overdue
    { status: "invoiced", created: "2026-07-08T00:00:00Z" }, // within window
    { status: "deposited", created: "2026-01-01T00:00:00Z" }, // wrong status
  ];
  for (const c of cases) {
    assertEquals(
      isMissingDeposit({ id: "x", status: c.status, created_at: c.created }, asOf),
      refDeposit(c.status, c.created, asOf),
    );
  }
});

// ---- Parity: instalment ----
Deno.test("parity: instalment classification matches production rule", () => {
  const tour = { instalment_required: true, instalment_date: "2026-06-01" };
  for (const status of ["invoiced", "deposited", "instalment_paid", "fully_paid", "racing_breaks_invoice"]) {
    assertEquals(
      isMissingInstalment({ id: "x", status, created_at: "2026-01-01T00:00:00Z" }, tour, asOf),
      refInstalment(status, tour, asOf),
    );
  }
  // Not required
  assertEquals(
    isMissingInstalment({ id: "x", status: "deposited", created_at: "2026-01-01T00:00:00Z" }, { instalment_required: false }, asOf),
    false,
  );
});

// ---- Parity: final balance ----
Deno.test("parity: final-balance classification matches production rule", () => {
  const tour = { final_payment_date: "2026-06-15" };
  for (const status of ["invoiced", "deposited", "instalment_paid", "fully_paid"]) {
    assertEquals(
      isOverdueFinalBalance({ id: "x", status, created_at: "2026-01-01T00:00:00Z" }, tour, asOf),
      refFinal(status, tour, asOf),
    );
  }
});

// ---- Multiple exceptions + deterministic priority ----
Deno.test("booking satisfying deposit + instalment picks deposit as primary", () => {
  // invoiced, created long ago (deposit), tour past instalment date (instalment)
  const tour = { instalment_required: true, instalment_date: "2026-06-01", deposit_required: 500, instalment_amount: 1000 };
  const res = classifyBookingPaymentException(
    { id: "x", status: "invoiced", created_at: "2026-01-01T00:00:00Z", passenger_count: 2 },
    tour,
    asOf,
  );
  assertEquals(res.primary_exception_type, "missing_deposit");
  assertEquals(res.all_applicable_exception_types, ["missing_deposit", "missing_instalment"]);
});

Deno.test("all three exceptions -> deposit primary, all three listed", () => {
  const tour = {
    instalment_required: true,
    instalment_date: "2026-06-01",
    final_payment_date: "2026-06-15",
    deposit_required: 500,
  };
  const res = classifyBookingPaymentException(
    { id: "x", status: "invoiced", created_at: "2026-01-01T00:00:00Z" },
    tour,
    asOf,
  );
  assertEquals(res.primary_exception_type, "missing_deposit");
  assertEquals(res.all_applicable_exception_types.length, 3);
});

Deno.test("instalment + final (deposited) -> instalment primary", () => {
  const tour = {
    instalment_required: true,
    instalment_date: "2026-06-01",
    final_payment_date: "2026-06-15",
  };
  const res = classifyBookingPaymentException(
    { id: "x", status: "deposited", created_at: "2026-01-01T00:00:00Z" },
    tour,
    asOf,
  );
  assertEquals(res.primary_exception_type, "missing_instalment");
});

// ---- Excluded statuses ----
Deno.test("cancelled/complimentary bookings are excluded", () => {
  for (const status of ["cancelled", "complimentary", "waitlisted", "host"]) {
    const res = classifyBookingPaymentException(
      { id: "x", status, created_at: "2026-01-01T00:00:00Z" },
      { final_payment_date: "2026-06-15" },
      asOf,
    );
    assertEquals(res.is_exception, false);
    assert(res.excluded_reason);
  }
});

// ---- Expected amounts / sources ----
Deno.test("deposit expected amount uses stored_tour_deposit x passengers", () => {
  const res = classifyBookingPaymentException(
    { id: "x", status: "invoiced", created_at: "2026-01-01T00:00:00Z", passenger_count: 3 },
    { deposit_required: 500 },
    asOf,
  );
  assertEquals(res.details.missing_deposit?.expected_amount, 1500);
  assertEquals(res.details.missing_deposit?.expected_amount_source, "stored_tour_deposit");
});

Deno.test("missing instalment amount -> null + unavailable (no derivation)", () => {
  const tour = { instalment_required: true, instalment_date: "2026-06-01" }; // no instalment_amount
  const res = classifyBookingPaymentException(
    { id: "x", status: "deposited", created_at: "2026-01-01T00:00:00Z" },
    tour,
    asOf,
  );
  assertEquals(res.details.missing_instalment?.expected_amount, null);
  assertEquals(res.details.missing_instalment?.expected_amount_source, "unavailable");
});

Deno.test("stored instalment amount is used when present, not derived", () => {
  const tour = { instalment_required: true, instalment_date: "2026-06-01", instalment_amount: 1200 };
  const res = classifyBookingPaymentException(
    { id: "x", status: "deposited", created_at: "2026-01-01T00:00:00Z" },
    tour,
    asOf,
  );
  assertEquals(res.details.missing_instalment?.expected_amount, 1200);
  assertEquals(res.details.missing_instalment?.expected_amount_source, "stored_instalment_amount");
});

Deno.test("final balance expected amount is always unavailable", () => {
  const res = classifyBookingPaymentException(
    { id: "x", status: "deposited", created_at: "2026-01-01T00:00:00Z" },
    { final_payment_date: "2026-06-15", deposit_required: 500 },
    asOf,
  );
  assertEquals(res.details.overdue_final_balance?.expected_amount, null);
  assertEquals(res.details.overdue_final_balance?.expected_amount_source, "unavailable");
});

// ---- report type filter ----
Deno.test("reportTypeFilter maps categories", () => {
  assertEquals(reportTypeFilter("missing_deposits"), ["missing_deposit"]);
  assertEquals(reportTypeFilter("all_payment_exceptions")?.length, 3);
  assertEquals(reportTypeFilter("bogus"), null);
});

// ---- Duplicate detection ----
Deno.test("multiple distinct invoices for one booking are NOT duplicates", () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 0, amount_paid: 100, total_amount: 100, xero_status: "PAID", updated_at: null, booking_id: "b1" },
    { xero_invoice_id: "INV-B", xero_invoice_number: "2", amount_due: 50, amount_paid: 0, total_amount: 50, xero_status: "AUTHORISED", updated_at: null, booking_id: "b1" },
  ];
  assertEquals(detectBookingDuplicate("b1", rows), null);
});

Deno.test("same invoice mapped twice to one booking is a duplicate", () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 0, amount_paid: 100, total_amount: 100, xero_status: "PAID", updated_at: null, booking_id: "b1" },
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 0, amount_paid: 100, total_amount: 100, xero_status: "PAID", updated_at: null, booking_id: "b1" },
  ];
  const d = detectBookingDuplicate("b1", rows);
  assert(d);
  assertEquals(d?.duplicate_type, "same_invoice_mapped_twice_same_booking");
  assertEquals(d?.mapping_count, 2);
});

Deno.test("same invoice mapped to two bookings is a cross-booking duplicate", () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-X", xero_invoice_number: "9", amount_due: 0, amount_paid: 10, total_amount: 10, xero_status: "PAID", updated_at: null, booking_id: "b1" },
    { xero_invoice_id: "INV-X", xero_invoice_number: "9", amount_due: 0, amount_paid: 10, total_amount: 10, xero_status: "PAID", updated_at: null, booking_id: "b2" },
  ];
  const dups = detectCrossBookingDuplicates(rows);
  assertEquals(dups.length, 1);
  assertEquals(dups[0].duplicate_type, "same_invoice_mapped_to_multiple_bookings");
  assertEquals(dups[0].affected_booking_ids.sort(), ["b1", "b2"]);
});

// ---- summarizeBookingXero (cache path, no live auth) ----
const noAuth = { ok: false as const, code: "XERO_NOT_CONNECTED" as const };

Deno.test("stale cache prevents high-confidence fully-paid conclusion", async () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 0, amount_paid: 100, total_amount: 100, xero_status: "PAID", updated_at: null, booking_id: "b1" },
  ];
  const pos = await summarizeBookingXero(noAuth as any, "b1", rows);
  assertEquals(pos.live_verification_completed, false);
  assertEquals(pos.xero_fully_paid, null); // not asserted from cache
  assertEquals(pos.partial_results, true);
});

Deno.test("voided invoice excluded from active balance (cache path)", async () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 500, amount_paid: 0, total_amount: 500, xero_status: "VOIDED", updated_at: new Date().toISOString(), booking_id: "b1" },
    { xero_invoice_id: "INV-B", xero_invoice_number: "2", amount_due: 0, amount_paid: 200, total_amount: 200, xero_status: "PAID", updated_at: new Date().toISOString(), booking_id: "b1" },
  ];
  const pos = await summarizeBookingXero(noAuth as any, "b1", rows);
  assertEquals(pos.active_invoice_count, 1);
  assertEquals(pos.outstanding_amount, 0); // voided 500 excluded
  assertEquals(pos.received_amount, 200);
});

Deno.test("one paid + one outstanding invoice -> outstanding remains", async () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 0, amount_paid: 100, total_amount: 100, xero_status: "PAID", updated_at: new Date().toISOString(), booking_id: "b1" },
    { xero_invoice_id: "INV-B", xero_invoice_number: "2", amount_due: 300, amount_paid: 0, total_amount: 300, xero_status: "AUTHORISED", updated_at: new Date().toISOString(), booking_id: "b1" },
  ];
  const pos = await summarizeBookingXero(noAuth as any, "b1", rows);
  assertEquals(pos.outstanding_amount, 300);
  assertEquals(pos.received_amount, 100);
  assertEquals(pos.active_invoice_count, 2);
});

Deno.test("no auth -> money source is xero_mapping_cache", async () => {
  const rows: MappingRow[] = [
    { xero_invoice_id: "INV-A", xero_invoice_number: "1", amount_due: 50, amount_paid: 0, total_amount: 50, xero_status: "AUTHORISED", updated_at: new Date().toISOString(), booking_id: "b1" },
  ];
  const pos = await summarizeBookingXero(noAuth as any, "b1", rows);
  assertEquals(pos.received_amount_source, "xero_mapping_cache");
  assertEquals(pos.outstanding_amount_source, "xero_mapping_cache");
});

Deno.test("no mappings -> amounts unavailable", async () => {
  const pos = await summarizeBookingXero(noAuth as any, "b1", []);
  assertEquals(pos.received_amount, null);
  assertEquals(pos.received_amount_source, "unavailable");
  assertEquals(pos.xero_fully_paid, null);
});

Deno.test("rules_version is exported", () => {
  assert(PAYMENT_RULES_VERSION.length > 0);
});