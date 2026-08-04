// Tour-agnostic timing-grounding tests plus the South Korea acceptance
// regression fixture. Output of the skill is always a PDF; the timing badges are
// audit metadata only and are never exported, so the prose must carry the times.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectContentConflicts,
  expectedTimingFacts,
  reconcileNarrativeTimings,
} from "./guestItineraryTimings.ts";
import { validateGuestItinerary } from "./guestItinerary.ts";

const TOUR_ID = "11111111-1111-4111-8111-111111111111";

const day = (
  date: string,
  paragraphs: string[],
  timings: { label?: string; time?: string; status?: string }[] = [],
  extra: Record<string, unknown> = {},
) => ({
  day_number: 1,
  date,
  title: "A day",
  meals: "Breakfast at the hotel.",
  transport: "Private coach.",
  narrative_paragraphs: paragraphs,
  timings,
  source_refs: { itinerary_entry_ids: [], activity_ids: [], hotel_ids: [] },
  warnings: [],
  ...extra,
});

const badge = (label: string, time: string, status = "confirmed") => ({
  label,
  time,
  status,
  source_type: "activity",
  source_id: null,
});

// ---------------------------------------------------------------- generic ----

Deno.test("confirmed Activity times must appear in narrative_paragraphs", () => {
  const facts = expectedTimingFacts({
    startDate: "2027-05-01",
    endDate: "2027-05-01",
    activities: [
      {
        id: "a1",
        name: "Welcome drinks",
        activity_date: "2027-05-01",
        start_time: "17:30:00",
        booking_status: "confirmed",
      },
    ],
  });
  assertEquals(facts.filter((f) => f.required).map((f) => f.time), ["5:30pm"]);

  const covered = reconcileNarrativeTimings(
    [day("2027-05-01", ["Meet in the lobby at 5:30pm for welcome drinks."], [badge("Welcome drinks", "5:30pm")])],
    facts,
  );
  assertEquals(covered.missing, []);

  const uncovered = reconcileNarrativeTimings(
    [day("2027-05-01", ["Enjoy welcome drinks this evening."], [badge("Welcome drinks", "5:30pm")])],
    facts,
  );
  assertEquals(uncovered.missing.length, 1);
  assertEquals(uncovered.missing[0].reason, "badge_only");
});

Deno.test("timings cannot exist only as badges and an empty timings array fails", () => {
  const facts = expectedTimingFacts({
    startDate: "2027-05-01",
    endDate: "2027-05-01",
    activities: [
      { id: "a1", name: "Race day", activity_date: "2027-05-01", depart_for_activity: "10:30", booking_status: "booked" },
    ],
  });
  const { missing } = reconcileNarrativeTimings(
    [day("2027-05-01", ["We depart for the racecourse at 10:30am."], [])],
    facts,
  );
  assertEquals(missing.length, 1);
  assertEquals(missing[0].reason, "timings_empty");
});

Deno.test("generation fails when a source time is missing from the prose", () => {
  const activities = [
    {
      id: "a1",
      name: "City tour",
      activity_date: "2027-05-01",
      start_time: "09:15:00",
      end_time: "13:00:00",
      booking_status: "confirmed",
    },
  ];
  const result = validateGuestItinerary(
    {
      schema_version: "1.0",
      tour: {
        id: TOUR_ID,
        name: "T",
        start_date: "2027-05-01",
        end_date: "2027-05-01",
        itinerary_version: 1,
      },
      days: [day("2027-05-01", ["The city tour begins at 9:15am."], [badge("City tour begins", "9:15am")])],
      unresolved_items: [],
      generation_summary: {
        complete_date_coverage: true,
        source_activity_count: 1,
        source_itinerary_entry_count: 0,
        source_hotel_count: 0,
      },
    },
    {
      tourId: TOUR_ID,
      startDate: "2027-05-01",
      endDate: "2027-05-01",
      sourceContext: { activities, itinerary: { days: [] } },
    },
  );
  assertEquals(result.missingTimings.length, 1);
  assertEquals(result.missingTimings[0].time, "1:00pm");
  assert(result.warnings.some((w) => w.includes("1:00pm")));
});

Deno.test("tentative times do not leak into client content unflagged", () => {
  const facts = expectedTimingFacts({
    startDate: "2027-05-01",
    endDate: "2027-05-01",
    activities: [
      {
        id: "a1",
        name: "Harbour dinner",
        activity_date: "2027-05-01",
        notes: "Dinner sitting at 8:00pm is TBC with the venue",
        booking_status: "pending",
      },
    ],
  });
  assertEquals(facts.every((f) => !f.required), true);
  const { warnings } = reconcileNarrativeTimings(
    [day("2027-05-01", ["Dinner is served at 8:00pm."], [badge("Dinner", "8:00pm", "tbc")])],
    facts,
  );
  assert(warnings.some((w) => w.includes("not confirmed")));
});

Deno.test("a meal that conflicts with the itinerary is flagged", () => {
  const source = new Map([["2027-05-01", "Evening at leisure - dinner is not included tonight."]]);
  const warnings = detectContentConflicts(
    [day("2027-05-01", ["Dinner is served in the hotel restaurant."], [], { meals: "Dinner included." })],
    source,
  );
  assert(warnings.some((w) => w.includes("conflict")));
});

Deno.test("cancelled activities never produce required timings", () => {
  const facts = expectedTimingFacts({
    startDate: "2027-05-01",
    endDate: "2027-05-01",
    activities: [
      { id: "a1", name: "Cancelled cruise", activity_date: "2027-05-01", start_time: "10:00", booking_status: "cancelled" },
    ],
  });
  assertEquals(facts, []);
});

// -------------------------------------------- South Korea regression fixture --
// Fixture only. No tour-specific logic exists in the implementation.

const SK_START = "2026-09-02";
const SK_END = "2026-09-11";

const skActivities = [
  {
    id: "sk-1",
    name: "Welcome drinks",
    activity_date: "2026-09-02",
    start_time: "17:30:00",
    booking_status: "confirmed",
    notes: "Group meets in the hotel lobby",
  },
  {
    id: "sk-2",
    name: "Flight to Seoul",
    activity_date: "2026-09-03",
    depart_for_activity: "06:15:00",
    start_time: "09:40:00",
    booking_status: "confirmed",
    transport_notes: "Airport check-in opens at 7:40am",
  },
  {
    id: "sk-3",
    name: "KTX to Busan",
    activity_date: "2026-09-05",
    depart_for_activity: "08:00:00",
    start_time: "08:45:00",
    end_time: "11:20:00",
    booking_status: "confirmed",
    notes: "Regrouping on the platform at 8:20am",
  },
  {
    id: "sk-4",
    name: "Busan race day",
    activity_date: "2026-09-06",
    depart_for_activity: "10:30:00",
    end_time: "19:00:00",
    booking_status: "confirmed",
    notes: "Return to the hotel at approximately 7:00pm",
    hospitality_inclusions: "Buffet lunch and beverages",
  },
  {
    id: "sk-5",
    name: "Free day in Seoul",
    activity_date: "2026-09-09",
    booking_status: "confirmed",
    notes: "No group meal this evening",
  },
  {
    id: "sk-6",
    name: "Seoul racing at Gwacheon",
    activity_date: "2026-09-11",
    depart_for_activity: "09:45:00",
    start_time: "11:00:00",
    end_time: "17:15:00",
    booking_status: "confirmed",
    notes: "No food or drinks included",
  },
];

const skDays = [
  day("2026-09-02", [
    "Arrive in Sydney and settle into the hotel before we gather in the lobby at 5:30pm for welcome drinks.",
  ], [badge("Welcome drinks", "5:30pm")]),
  day("2026-09-03", [
    "We depart the hotel at 6:15am, with airport check-in from 7:40am ahead of our 9:40am flight to Seoul.",
  ], [badge("Depart hotel", "6:15am"), badge("Check-in", "7:40am"), badge("Flight", "9:40am")]),
  day("2026-09-05", [
    "Leave the hotel at 8:00am and regroup on the platform at 8:20am for the 8:45am KTX, arriving in Busan at 11:20am.",
  ], [badge("KTX", "8:45am to 11:20am")]),
  day("2026-09-06", [
    "We depart for the racecourse at 10:30am for a full day of racing, with the last race run by 7:00pm and a return to the hotel at approximately 7:00pm.",
  ], [badge("Depart", "10:30am"), badge("Return", "7:00pm")], { meals: "Buffet lunch and beverages at the track." }),
  day("2026-09-09", [
    "A free day in Seoul to explore at your own pace.",
  ], [], { meals: "Breakfast at the hotel only." }),
  day("2026-09-11", [
    "We depart at 9:45am for Seoul racing at Gwacheon, where the first race is run at 11:00am and the meeting concludes at 5:15pm.",
  ], [badge("Depart", "9:45am"), badge("Racing", "11:00am to 5:15pm")], {
    meals: "No food or drinks included.",
  }),
];

Deno.test("South Korea regression: every confirmed time is carried by the prose", () => {
  const facts = expectedTimingFacts({ startDate: SK_START, endDate: SK_END, activities: skActivities });
  const { missing } = reconcileNarrativeTimings(skDays, facts);
  assertEquals(missing, []);
});

Deno.test("South Korea regression: key day content matches the reference document", () => {
  const byDate = new Map(skDays.map((d) => [d.date, d]));
  const prose = (date: string) =>
    `${byDate.get(date)!.narrative_paragraphs.join(" ")} ${byDate.get(date)!.meals ?? ""}`;

  // 2 September — 5:30pm welcome drinks meeting.
  assert(/5:30pm/.test(prose("2026-09-02")) && /welcome drinks/i.test(prose("2026-09-02")));
  // 3 September — flight and check-in times.
  assert(/7:40am/.test(prose("2026-09-03")) && /9:40am/.test(prose("2026-09-03")));
  // 5 September — KTX, regrouping and arrival.
  assert(/8:20am/.test(prose("2026-09-05")) && /8:45am/.test(prose("2026-09-05")) && /11:20am/.test(prose("2026-09-05")));
  // 6 September — 10:30am meeting and approximately 7:00pm return.
  assert(/10:30am/.test(prose("2026-09-06")));
  assert(/approximately 7:00pm/.test(prose("2026-09-06")));
  // 9 September — no dinner.
  assertEquals(/dinner/i.test(prose("2026-09-09")), false);
  // 11 September — confirmed racing wording and the no-catering statement.
  assert(/racing/i.test(prose("2026-09-11")));
  assert(/No food or drinks included/i.test(prose("2026-09-11")));
});

Deno.test("South Korea regression: removing a time blocks the save", () => {
  const facts = expectedTimingFacts({ startDate: SK_START, endDate: SK_END, activities: skActivities });
  const edited = skDays.map((d) =>
    d.date === "2026-09-06"
      ? { ...d, narrative_paragraphs: ["A full day of racing in Busan."] }
      : d
  );
  const { missing } = reconcileNarrativeTimings(edited, facts);
  assert(missing.length >= 2);
  assert(missing.every((m) => m.date === "2026-09-06"));
});

Deno.test("South Korea regression: no dinner is claimed on the free day", () => {
  const sourceText = new Map([
    ["2026-09-09", "Free day in Seoul. Breakfast at the hotel. No group meal this evening."],
  ]);
  const freeDay = skDays.filter((d) => d.date === "2026-09-09");
  const conflicts = detectContentConflicts(freeDay, sourceText);
  assertEquals(conflicts.filter((c) => /dinner/i.test(c)), []);
  assertEquals(conflicts, []);
});
