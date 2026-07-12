import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDateContext,
  financialYear,
  selectNextDepartingTour,
  todayInTimezone,
  type CandidateTour,
} from "./artAiDates.ts";

// ---- Date grounding is server-derived, not browser/model supplied ----
Deno.test("current date is derived from a server Date, not a hardcoded value", () => {
  const now = new Date("2026-07-12T04:00:00Z");
  const dc = buildDateContext(now);
  assertEquals(dc.current_date, "2026-07-12"); // 14:00 Sydney (AEST +10)
  assertEquals(dc.timezone, "Australia/Sydney");
  // Ensure it tracks the input, not a frozen constant.
  const dc2 = buildDateContext(new Date("2027-01-02T04:00:00Z"));
  assertEquals(dc2.current_date, "2027-01-02");
});

// ---- Australia/Sydney boundary around UTC midnight ----
Deno.test("Sydney date rolls to next day before UTC midnight", () => {
  // 2026-07-12 15:00 UTC = 2026-07-13 01:00 AEST
  assertEquals(todayInTimezone("Australia/Sydney", new Date("2026-07-12T15:00:00Z")), "2026-07-13");
  // 2026-07-12 13:00 UTC = 2026-07-12 23:00 AEST (still 12th)
  assertEquals(todayInTimezone("Australia/Sydney", new Date("2026-07-12T13:00:00Z")), "2026-07-12");
});

// ---- No stale hard-coded example date ----
Deno.test("no stale 6 June 2024 date anywhere in the context", () => {
  const dc = buildDateContext(new Date("2026-07-12T04:00:00Z"));
  const blob = JSON.stringify(dc);
  assertEquals(blob.includes("2024-06-06"), false);
  assertEquals(blob.includes("2024"), false);
});

// ---- Financial year (AU: 1 Jul – 30 Jun) ----
Deno.test("financial year boundaries", () => {
  assertEquals(financialYear("2026-07-01"), "FY2026-2027");
  assertEquals(financialYear("2026-06-30"), "FY2025-2026");
});

const T = (o: Partial<CandidateTour> & { id: string; start_date: string }): CandidateTour => ({
  name: o.name ?? o.id,
  status: o.status ?? "available",
  is_test_tour: o.is_test_tour ?? false,
  created_at: o.created_at ?? "2025-01-01T00:00:00Z",
  ...o,
});

const AS_OF = "2026-07-12";

Deno.test("selects earliest future tour from mixed 2026 and 2027 tours", () => {
  const rows = [
    T({ id: "durban2027", start_date: "2027-07-01" }),
    T({ id: "darwin2026", start_date: "2026-07-29" }),
    T({ id: "palio2026", start_date: "2026-08-14" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "darwin2026");
});

Deno.test("descending input order cannot change the deterministic pick", () => {
  const asc = [
    T({ id: "a", start_date: "2026-07-29" }),
    T({ id: "b", start_date: "2026-08-14" }),
    T({ id: "c", start_date: "2027-07-01" }),
  ];
  const desc = [...asc].reverse();
  assertEquals(selectNextDepartingTour(asc, { asOf: AS_OF })?.id, "a");
  assertEquals(selectNextDepartingTour(desc, { asOf: AS_OF })?.id, "a");
});

Deno.test("first returned list item is not assumed to be next", () => {
  // The furthest-future tour is listed first (simulating list_tours desc).
  const rows = [
    T({ id: "far", start_date: "2027-07-01" }),
    T({ id: "soon", start_date: "2026-07-29" }),
  ];
  const picked = selectNextDepartingTour(rows, { asOf: AS_OF });
  assertEquals(picked?.id, "soon");
  assertEquals(picked?.id === rows[0].id, false);
});

Deno.test("past tours are excluded", () => {
  const rows = [
    T({ id: "past", start_date: "2026-06-01" }),
    T({ id: "future", start_date: "2026-09-01" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "future");
});

Deno.test("same-day tour is included (>= as_of)", () => {
  const rows = [T({ id: "today", start_date: AS_OF })];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "today");
});

Deno.test("cancelled tours excluded by default, included when requested", () => {
  const rows = [
    T({ id: "cancelled", start_date: "2026-07-20", status: "cancelled" }),
    T({ id: "ok", start_date: "2026-08-01" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "ok");
  assertEquals(
    selectNextDepartingTour(rows, { asOf: AS_OF, includeCancelled: true })?.id,
    "cancelled",
  );
});

Deno.test("archived tours are always excluded", () => {
  const rows = [
    T({ id: "archived", start_date: "2026-07-20", status: "archived" }),
    T({ id: "ok", start_date: "2026-08-01" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "ok");
  assertEquals(
    selectNextDepartingTour(rows, { asOf: AS_OF, includeCancelled: true, includeTestTours: true })?.id,
    "ok",
  );
});

Deno.test("test tours excluded by default, included when requested", () => {
  const rows = [
    T({ id: "test", start_date: "2026-07-20", is_test_tour: true }),
    T({ id: "real", start_date: "2026-08-01" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "real");
  assertEquals(
    selectNextDepartingTour(rows, { asOf: AS_OF, includeTestTours: true })?.id,
    "test",
  );
});

Deno.test("deterministic secondary ordering on same start_date", () => {
  const rows = [
    T({ id: "z", name: "Zebra Tour", start_date: "2026-07-20" }),
    T({ id: "a", name: "Alpha Tour", start_date: "2026-07-20" }),
  ];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF })?.id, "a");
});

Deno.test("no upcoming tour returns null", () => {
  const rows = [T({ id: "old", start_date: "2020-01-01" })];
  assertEquals(selectNextDepartingTour(rows, { asOf: AS_OF }), null);
});
