import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isFinancialRole,
  isUuid,
  safeErrorMessage,
  computeStaleWarning,
  mapXeroStatusToBookingStatus,
  normalizeInvoice,
  normalizePayments,
  daysOverdue,
  pickLowestProposedStatus,
} from "../../../src/lib/mcp/tools/_xeroLogic.ts";

// ---- Financial access role gate ----
Deno.test("admin is granted financial access", () => {
  assert(isFinancialRole(["admin"]));
});
Deno.test("manager is granted financial access", () => {
  assert(isFinancialRole(["manager"]));
});
Deno.test("host is denied financial access", () => {
  assertEquals(isFinancialRole(["host"]), false);
});
Deno.test("agent is denied financial access", () => {
  assertEquals(isFinancialRole(["agent"]), false);
});
Deno.test("booking_agent is denied financial access", () => {
  assertEquals(isFinancialRole(["booking_agent"]), false);
});
Deno.test("no roles is denied financial access", () => {
  assertEquals(isFinancialRole([]), false);
});
Deno.test("mixed roles including admin is granted", () => {
  assert(isFinancialRole(["host", "admin"]));
});

// ---- Input validation ----
Deno.test("valid uuid accepted", () => {
  assert(isUuid("0332a293-c965-4d68-9941-88dfa7efbbcc"));
});
Deno.test("invalid booking id rejected", () => {
  assertEquals(isUuid("not-a-uuid"), false);
  assertEquals(isUuid("12345"), false);
  assertEquals(isUuid(""), false);
});

// ---- Error redaction: never leak tokens/secrets ----
Deno.test("error messages never contain token/secret text", () => {
  const codes = [
    "UNAUTHENTICATED",
    "FINANCIAL_ACCESS_DENIED",
    "XERO_TOKEN_REFRESH_FAILED",
    "XERO_RATE_LIMITED",
    "INTERNAL_ERROR",
  ] as const;
  for (const c of codes) {
    const msg = safeErrorMessage(c).toLowerCase();
    assert(!msg.includes("bearer"));
    assert(!msg.includes("access_token"));
    assert(!msg.includes("refresh_token"));
    assert(!msg.includes("secret"));
  }
});

// ---- Stale mapping detection ----
Deno.test("missing updated_at is stale", () => {
  assert(computeStaleWarning(null));
});
Deno.test("recent update is not stale", () => {
  assertEquals(computeStaleWarning(new Date().toISOString()), false);
});
Deno.test("old update is stale", () => {
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert(computeStaleWarning(old));
});

// ---- Status inference (read-only) ----
Deno.test("fully paid invoice -> fully_paid", () => {
  assertEquals(
    mapXeroStatusToBookingStatus("PAID", 0, 1000, false, "deposited"),
    "fully_paid",
  );
});
Deno.test("never downgrades status", () => {
  assertEquals(
    mapXeroStatusToBookingStatus("AUTHORISED", 500, 0, false, "fully_paid"),
    null,
  );
});
Deno.test("deposit-level payment -> deposited", () => {
  assertEquals(
    mapXeroStatusToBookingStatus("AUTHORISED", 500, 500, true, "invoiced", 1, 500),
    "deposited",
  );
});
Deno.test("instalment above deposit -> instalment_paid", () => {
  assertEquals(
    mapXeroStatusToBookingStatus("AUTHORISED", 200, 800, true, "deposited", 1, 500),
    "instalment_paid",
  );
});
Deno.test("lowest proposed status across invoices chosen", () => {
  assertEquals(pickLowestProposedStatus(["fully_paid", "deposited", "invoiced"]), "invoiced");
  assertEquals(pickLowestProposedStatus([null, null]), null);
});

// ---- Invoice normalisation (redaction to surfaced fields only) ----
Deno.test("normalizeInvoice maps fields and drops unknown data", () => {
  const raw = {
    InvoiceID: "abc",
    InvoiceNumber: "INV-1",
    Type: "ACCREC",
    Contact: { ContactID: "c1", Name: "Jane" },
    DateString: "2026-04-02T00:00:00",
    DueDateString: "2026-05-02T00:00:00",
    CurrencyCode: "AUD",
    SubTotal: 100,
    TotalTax: 10,
    Total: 110,
    AmountPaid: 40,
    AmountDue: 70,
    Status: "AUTHORISED",
    Reference: "REF1",
    SecretInternalField: "should-not-appear",
    CreditNotes: [{ AppliedAmount: 5 }],
  };
  const n = normalizeInvoice(raw);
  assertEquals(n.invoice_number, "INV-1");
  assertEquals(n.contact_id, "c1");
  assertEquals(n.date, "2026-04-02");
  assertEquals(n.due_date, "2026-05-02");
  assertEquals(n.total, 110);
  assertEquals(n.amount_paid, 40);
  assertEquals(n.credit_notes_applied, 5);
  assert(!Object.keys(n).includes("SecretInternalField"));
});

Deno.test("multiple payments normalised", () => {
  const raw = { Payments: [
    { PaymentID: "p1", DateString: "2026-04-05T00:00:00", Amount: 20, Reference: "a" },
    { PaymentID: "p2", DateString: "2026-04-10T00:00:00", Amount: 20, Reference: "b" },
  ] };
  const p = normalizePayments(raw);
  assertEquals(p.length, 2);
  assertEquals(p[0].amount, 20);
  assertEquals(p[1].payment_id, "p2");
});

Deno.test("days overdue computed and clamped to zero", () => {
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  assert(daysOverdue(past) >= 4);
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  assertEquals(daysOverdue(future), 0);
  assertEquals(daysOverdue(null), 0);
});