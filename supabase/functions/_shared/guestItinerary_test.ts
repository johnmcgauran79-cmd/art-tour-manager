import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGuestItinerarySourceContext,
  dateRange,
  validateGuestItinerary,
} from "./guestItinerary.ts";

const tourResult = {
  tour: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test Tour",
    start_date: "2027-05-01",
    end_date: "2027-05-03",
    location: "Somewhere",
  },
};

const itineraryResult = {
  itinerary: {
    id: "22222222-2222-4222-8222-222222222222",
    version: 2,
    days: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        day_number: 1,
        activity_date: "2027-05-01",
        entries: [
          { id: "44444444-4444-4444-8444-444444444444", subject: "Arrival", content: "<p>Welcome &amp; settle in.</p><p>Dinner tonight.</p>" },
        ],
      },
    ],
  },
};

Deno.test("context normalisation flattens tool payloads and strips HTML", () => {
  const ctx = buildGuestItinerarySourceContext({
    tourResult,
    itineraryResult,
    activitiesResult: { activities: [] },
    hotelsResult: { hotels: [] },
  });
  assertEquals(ctx.tour.id, tourResult.tour.id);
  assertEquals(ctx.source_summary.itinerary_version, 2);
  const day = (ctx.itinerary.days as any[])[0];
  assertEquals(day.entries[0].content, "Welcome & settle in.\n\nDinner tonight.");
});

Deno.test("activities outside the tour range are flagged, not dropped silently", () => {
  const ctx = buildGuestItinerarySourceContext({
    tourResult,
    itineraryResult,
    activitiesResult: {
      activities: [
        { id: "a1", name: "Late race day", activity_date: "2027-06-01" },
      ],
    },
    hotelsResult: { hotels: [] },
  });
  assert(ctx.preflight_warnings.some((w) => w.includes("outside the tour date range")));
});

Deno.test("tentative wording is flagged for staff review", () => {
  const ctx = buildGuestItinerarySourceContext({
    tourResult,
    itineraryResult,
    activitiesResult: {
      activities: [{ id: "a1", activity_date: "2027-05-02", notes: "Dinner venue TBC" }],
    },
    hotelsResult: { hotels: [] },
  });
  assert(ctx.preflight_warnings.some((w) => w.includes("tentative wording")));
});

Deno.test("invalid tour dates are rejected", () => {
  assertThrows(() =>
    buildGuestItinerarySourceContext({
      tourResult: { tour: { id: "x", name: "T" } },
      itineraryResult,
      activitiesResult: {},
      hotelsResult: {},
    })
  );
});

Deno.test("dateRange is inclusive", () => {
  assertEquals(dateRange("2027-05-01", "2027-05-03"), ["2027-05-01", "2027-05-02", "2027-05-03"]);
});

const day = (date: string, overrides: Record<string, unknown> = {}) => ({
  day_number: 1,
  date,
  title: "A day",
  meals: "Breakfast at the hotel.",
  transport: "Private coach.",
  narrative_paragraphs: ["Some polished prose."],
  timings: [],
  source_refs: { itinerary_entry_ids: [], activity_ids: [], hotel_ids: [] },
  warnings: [],
  ...overrides,
});

const baseDraft = (days: unknown[]) => ({
  schema_version: "1.0",
  tour: {
    id: tourResult.tour.id,
    name: "Test Tour",
    start_date: "2027-05-01",
    end_date: "2027-05-03",
    itinerary_version: 2,
  },
  days,
  unresolved_items: [],
  generation_summary: {
    complete_date_coverage: true,
    source_activity_count: 0,
    source_itinerary_entry_count: 1,
    source_hotel_count: 0,
  },
});

const expected = { tourId: tourResult.tour.id, startDate: "2027-05-01", endDate: "2027-05-03" };

Deno.test("missing date coverage is reported", () => {
  const { draft, warnings } = validateGuestItinerary(baseDraft([day("2027-05-01")]), expected);
  assert(warnings.some((w) => w.includes("2027-05-02")));
  assertEquals(draft.generation_summary.complete_date_coverage, false);
});

Deno.test("full date coverage passes without coverage warnings", () => {
  const { draft, warnings } = validateGuestItinerary(
    baseDraft([day("2027-05-01"), day("2027-05-02"), day("2027-05-03")]),
    expected,
  );
  assertEquals(draft.generation_summary.complete_date_coverage, true);
  assertEquals(warnings.filter((w) => w.includes("No day was generated")).length, 0);
});

Deno.test("transport line must be mode only", () => {
  const { warnings } = validateGuestItinerary(
    baseDraft([
      day("2027-05-01", { transport: "Private coach departing at 9:15am. Return after the race." }),
    ]),
    expected,
  );
  assert(warnings.some((w) => w.includes("transport line")));
});

Deno.test("a draft for another tour is rejected", () => {
  assertThrows(() =>
    validateGuestItinerary(baseDraft([day("2027-05-01")]), {
      ...expected,
      tourId: "99999999-9999-4999-8999-999999999999",
    })
  );
});

Deno.test("an empty draft is rejected", () => {
  assertThrows(() => validateGuestItinerary(baseDraft([]), expected));
});

Deno.test("unrecognised timing formats are flagged", () => {
  const { warnings } = validateGuestItinerary(
    baseDraft([
      day("2027-05-01", {
        timings: [{ label: "Depart", time: "0915", status: "confirmed", source_type: "activity", source_id: null }],
      }),
    ]),
    expected,
  );
  assert(warnings.some((w) => w.includes("unrecognised time format")));
});
