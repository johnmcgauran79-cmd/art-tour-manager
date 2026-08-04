export const GUEST_ITINERARY_SKILL_ID = "create_guest_document_itinerary";

export const GUEST_ITINERARY_SKILL_PROMPT = `
You are ART AI running the "Create Guest Document Itinerary" skill.

Your input is a server-assembled STRUCTURED CONTEXT for one ART Admin tour. Treat it as authoritative but identify inconsistencies inside it.

Produce only JSON matching the supplied Guest Document Itinerary schema.

Core rules:
- Use only the structured context. Never invent a date, time, venue, meal, transport mode, inclusion or booking status.
- Create exactly one day for every date from tour.start_date through tour.end_date.
- Preserve the polished tone and substance of the current ART Admin Itinerary entries. They are the narrative base.
- TIMING IS MANDATORY. For every in-range Activity, take every confirmed guest-relevant time from start_time, end_time,
  depart_for_activity, pickup information and confirmed notes/transport notes, and weave each one into that day's
  narrative_paragraphs as natural prose. This includes meeting, departure, event, flight, train, check-in, regrouping
  and return times. Example: "Meet in the hotel lobby at 5:30pm for welcome drinks." Never use bullet points or a
  timetable, and never leave a confirmed time out of the prose because it also appears in timings.
- The timings array is audit metadata for staff only. It is not exported to the guest PDF, so a time listed only there
  is invisible to guests and counts as missing. Every confirmed guest-relevant time must be in the prose AND in timings.
- Meals must be concise and explicit, and grounded principally in Activity hospitality_inclusions and the Itinerary.
  Never present a meal or transfer that the current Itinerary contradicts or excludes; if the Itinerary says a meal is
  not included, either say so plainly or omit it, and record the conflict in unresolved_items.
- Follow staff_instructions when present. They refine this draft only and never change tour records.
- Transport must state mode only. Never put times, meeting places, return details or a second explanatory sentence in the Transport field.
- Use Hotels only for accommodation and transition context supported by their dates.
- Use Australian English. In prose, write dates in d MMMM yyyy form (for example 2 September 2026).
- The "date" FIELD of every day must be the machine format yyyy-MM-dd (for example 2026-09-02). Never put a prose date such as "2 September 2026" in that field.
- Times must be clock times only, such as 9:15am, 5:30pm, or a range like 9:30am to 11:40am. Never put a date in a "time" field.
- Do not expose internal notes, UUIDs, supplier contacts, driver details, payment information or system metadata in client-facing fields.
- Do not silently resolve a material conflict between sources. Add it to unresolved_items and the applicable day warnings.
- Flag tentative language such as maybe, proposed, subject to confirmation and TBC.
- Activities outside the tour date range do not become client itinerary days; flag them for staff review.
- Do not use website content and do not suggest that any data or document was saved, uploaded or published.

Day output:
- title: client-friendly, normally based on the current Itinerary subject.
- meals: one concise, explicit sentence.
- transport: mode only, in a single short sentence. No times, no locations, no return details, no second sentence.
- narrative_paragraphs: one or two polished paragraphs containing every confirmed guest-relevant time for that day.
- timings: the same timing facts again, as traceable metadata for staff.
  Each timing "time" is a clock time or clock-time range only, never a date.
- source_refs: source record ids for staff audit only.
- warnings: day-specific review issues for staff only.
`.trim();

export type AnyRecord = Record<string, unknown>;

export interface GuestItinerarySourceContext {
  tour: AnyRecord;
  itinerary: AnyRecord;
  activities: AnyRecord[];
  hotels: AnyRecord[];
  additional_information?: AnyRecord;
  staff_instructions?: string | null;
  source_summary: {
    tour_id: string;
    itinerary_version: number | null;
    generated_at: string;
    timezone: "Australia/Sydney";
  };
  preflight_warnings: string[];
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => !!item && typeof item === "object") : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateOnly(value: unknown): string | null {
  const text = stringValue(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function boundedText(value: unknown, maxLength = 4000): string | null {
  const text = stringValue(value);
  return text ? text.slice(0, maxLength) : null;
}

function stripHtml(value: unknown): string | null {
  const text = boundedText(value, 10000);
  if (!text) return null;
  return text
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractItinerary(raw: AnyRecord): AnyRecord {
  const nested = raw.itinerary;
  return nested && typeof nested === "object" ? nested as AnyRecord : raw;
}

function extractRows(raw: AnyRecord, keys: string[]): AnyRecord[] {
  for (const key of keys) {
    const rows = asArray(raw[key]);
    if (rows.length || Array.isArray(raw[key])) return rows;
  }
  return [];
}

/**
 * Build the only object that should be sent to the language model.
 * Fetch all inputs with the signed-in user's JWT so ART Admin RLS remains in force.
 */
export function buildGuestItinerarySourceContext(args: {
  tourResult: AnyRecord;
  itineraryResult: AnyRecord;
  activitiesResult: AnyRecord;
  hotelsResult: AnyRecord;
  additionalInformationResult?: AnyRecord;
  staffInstructions?: string | null;
  generatedAt?: string;
}): GuestItinerarySourceContext {
  const tour =
    args.tourResult.tour && typeof args.tourResult.tour === "object"
      ? args.tourResult.tour as AnyRecord
      : args.tourResult;
  const itinerary = extractItinerary(args.itineraryResult);
  const rawActivities = extractRows(args.activitiesResult, ["activities", "data"]);
  const rawHotels = extractRows(args.hotelsResult, ["hotels", "data"]);

  const tourId = stringValue(tour.id) ?? stringValue(tour.tour_id);
  const startDate = dateOnly(tour.start_date);
  const endDate = dateOnly(tour.end_date);
  if (!tourId) throw new Error("Guest itinerary generation requires a tour id.");
  if (!startDate || !endDate) throw new Error("Guest itinerary generation requires valid tour dates.");
  if (endDate < startDate) throw new Error("Tour end date cannot be earlier than its start date.");

  const preflightWarnings: string[] = [];
  const outsideRange = rawActivities.filter((activity) => {
    const date = dateOnly(activity.activity_date);
    return !!date && (date < startDate || date > endDate);
  });
  if (outsideRange.length) {
    preflightWarnings.push(
      `${outsideRange.length} Activity record(s) fall outside the tour date range and must not become Guest Document days.`,
    );
  }

  const itineraryDays = extractRows(itinerary, ["tour_itinerary_days", "days"]);
  if (!itineraryDays.length) {
    preflightWarnings.push("No current ART Admin Itinerary days were returned.");
  }

  const tentativePattern = /\b(maybe|proposed|subject to confirmation|tbc|to be confirmed)\b/i;
  const tentativeActivities = rawActivities.filter((activity) =>
    [activity.notes, activity.operations_notes, activity.hospitality_inclusions, activity.transport_notes]
      .some((value) => typeof value === "string" && tentativePattern.test(value)),
  );
  if (tentativeActivities.length) {
    preflightWarnings.push(
      `${tentativeActivities.length} Activity record(s) contain tentative wording and require staff review.`,
    );
  }

  // Keep the model context bounded and limited to itinerary-relevant fields.
  const compactTour: AnyRecord = {
    id: tourId,
    name: boundedText(tour.name, 300),
    start_date: startDate,
    end_date: endDate,
    days: tour.days,
    nights: tour.nights,
    location: boundedText(tour.location, 300),
    tour_type: boundedText(tour.tour_type, 100),
    inclusions: boundedText(tour.inclusions, 6000),
    exclusions: boundedText(tour.exclusions, 6000),
  };

  const compactItineraryDays = itineraryDays.map((day) => {
    const entries = extractRows(day, ["tour_itinerary_entries", "entries"])
      .map((entry) => ({
        id: stringValue(entry.id),
        time_slot: stringValue(entry.time_slot),
        subject: boundedText(entry.subject, 500),
        content: stripHtml(entry.content),
        sort_order: entry.sort_order,
      }));
    return {
      id: stringValue(day.id),
      day_number: day.day_number,
      activity_date: dateOnly(day.activity_date),
      entries,
    };
  });

  const compactItinerary: AnyRecord = {
    id: stringValue(itinerary.id),
    version: itinerary.version,
    is_current: itinerary.is_current,
    title: boundedText(itinerary.title, 500),
    days: compactItineraryDays,
  };

  const activities = rawActivities.map((activity) => ({
    id: stringValue(activity.id),
    name: boundedText(activity.name, 500),
    activity_date: dateOnly(activity.activity_date),
    start_time: stringValue(activity.start_time),
    end_time: stringValue(activity.end_time),
    depart_for_activity: stringValue(activity.depart_for_activity),
    booking_status: stringValue(activity.booking_status),
    location: boundedText(activity.location, 500),
    pickup_location_transport: boundedText(activity.pickup_location_transport, 500),
    transport_mode: boundedText(activity.transport_mode, 100),
    hospitality_inclusions: boundedText(activity.hospitality_inclusions, 3000),
    notes: boundedText(activity.notes, 5000),
    transport_notes: boundedText(activity.transport_notes, 2000),
    operations_notes: boundedText(activity.operations_notes, 2500),
    dress_code: boundedText(activity.dress_code, 100),
  }));

  const hotels = rawHotels.map((hotel) => ({
    id: stringValue(hotel.id),
    name: boundedText(hotel.name, 500),
    address: boundedText(hotel.address, 1000),
    default_check_in: dateOnly(hotel.default_check_in),
    default_check_out: dateOnly(hotel.default_check_out),
  }));

  return {
    tour: compactTour,
    itinerary: compactItinerary,
    activities,
    hotels,
    additional_information: args.additionalInformationResult,
    staff_instructions: stringValue(args.staffInstructions),
    source_summary: {
      tour_id: tourId,
      itinerary_version:
        typeof itinerary.version === "number" ? itinerary.version : null,
      generated_at: args.generatedAt ?? new Date().toISOString(),
      timezone: "Australia/Sydney",
    },
    preflight_warnings: preflightWarnings,
  };
}

export const GUEST_ITINERARY_REQUIRED_TOOLS = [
  "get_tour",
  "get_tour_itinerary",
  "list_tour_activities",
  "list_tour_hotels",
  "list_tour_additional_info",
] as const;

// ---------------------------------------------------------------------------
// Structured output contract
// ---------------------------------------------------------------------------
// OpenAI strict json_schema does not accept format/minLength/minItems/pattern,
// so the wire schema carries types + enums only and the shape constraints from
// guest-itinerary-output-schema.json are enforced by validateGuestItinerary().

export const GUEST_ITINERARY_JSON_SCHEMA = {
  name: "guest_document_itinerary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["schema_version", "tour", "days", "unresolved_items", "generation_summary"],
    properties: {
      schema_version: { type: "string" },
      tour: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "start_date", "end_date", "itinerary_version"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          itinerary_version: { type: ["integer", "null"] },
        },
      },
      days: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "day_number",
            "date",
            "title",
            "meals",
            "transport",
            "narrative_paragraphs",
            "timings",
            "source_refs",
            "warnings",
          ],
          properties: {
            day_number: { type: "integer" },
            date: { type: "string" },
            title: { type: "string" },
            meals: { type: "string" },
            transport: { type: "string" },
            narrative_paragraphs: { type: "array", items: { type: "string" } },
            timings: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "time", "status", "source_type", "source_id"],
                properties: {
                  label: { type: "string" },
                  time: { type: "string" },
                  status: { enum: ["confirmed", "approximate", "tbc"] },
                  source_type: { enum: ["activity", "itinerary", "hotel", "staff_instruction"] },
                  source_id: { type: ["string", "null"] },
                },
              },
            },
            source_refs: {
              type: "object",
              additionalProperties: false,
              required: ["itinerary_entry_ids", "activity_ids", "hotel_ids"],
              properties: {
                itinerary_entry_ids: { type: "array", items: { type: "string" } },
                activity_ids: { type: "array", items: { type: "string" } },
                hotel_ids: { type: "array", items: { type: "string" } },
              },
            },
            warnings: { type: "array", items: { type: "string" } },
          },
        },
      },
      unresolved_items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["date", "field", "issue", "recommended_action", "source_refs"],
          properties: {
            date: { type: ["string", "null"] },
            field: {
              enum: ["date", "title", "narrative", "time", "meal", "transport", "hotel", "source"],
            },
            issue: { type: "string" },
            recommended_action: { type: "string" },
            source_refs: { type: "array", items: { type: "string" } },
          },
        },
      },
      generation_summary: {
        type: "object",
        additionalProperties: false,
        required: [
          "complete_date_coverage",
          "source_activity_count",
          "source_itinerary_entry_count",
          "source_hotel_count",
        ],
        properties: {
          complete_date_coverage: { type: "boolean" },
          source_activity_count: { type: "integer" },
          source_itinerary_entry_count: { type: "integer" },
          source_hotel_count: { type: "integer" },
        },
      },
    },
  },
} as const;

export interface GuestItineraryTiming {
  label: string;
  time: string;
  status: "confirmed" | "approximate" | "tbc";
  source_type: "activity" | "itinerary" | "hotel" | "staff_instruction";
  source_id: string | null;
}

export interface GuestItineraryDay {
  day_number: number;
  date: string;
  title: string;
  meals: string;
  transport: string;
  narrative_paragraphs: string[];
  timings: GuestItineraryTiming[];
  source_refs: {
    itinerary_entry_ids: string[];
    activity_ids: string[];
    hotel_ids: string[];
  };
  warnings: string[];
}

export interface GuestItineraryUnresolvedItem {
  date: string | null;
  field: "date" | "title" | "narrative" | "time" | "meal" | "transport" | "hotel" | "source";
  issue: string;
  recommended_action: string;
  source_refs: string[];
}

export interface GuestItineraryDraft {
  schema_version: string;
  tour: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    itinerary_version: number | null;
  };
  days: GuestItineraryDay[];
  unresolved_items: GuestItineraryUnresolvedItem[];
  generation_summary: {
    complete_date_coverage: boolean;
    source_activity_count: number;
    source_itinerary_entry_count: number;
    source_hotel_count: number;
  };
}

import {
  coerceDate,
  DATE_RE,
  dateForDayNumber,
  dateRange,
  normaliseTimeValue,
} from "./guestItineraryTime.ts";
import {
  detectContentConflicts,
  expectedTimingFacts,
  reconcileNarrativeTimings,
  type MissingTiming,
  type TimingFact,
} from "./guestItineraryTimings.ts";

export { dateRange, normaliseTimeValue };
export type { MissingTiming, TimingFact };

/** Itinerary + Activity text for each date, used for meal/transfer conflict checks. */
export function buildSourceTextByDate(context: {
  itinerary?: AnyRecord;
  activities?: AnyRecord[];
}): Map<string, string> {
  const map = new Map<string, string>();
  const add = (date: string | null, text: unknown) => {
    if (!date || typeof text !== "string" || !text.trim()) return;
    map.set(date, `${map.get(date) ?? ""}\n${text}`);
  };
  for (const day of asArray((context.itinerary as AnyRecord | undefined)?.days)) {
    const date = coerceDate(day.activity_date);
    for (const entry of asArray(day.entries)) {
      add(date, entry.subject as string);
      add(date, entry.content as string);
    }
  }
  for (const activity of context.activities ?? []) {
    const date = coerceDate(activity.activity_date);
    add(date, activity.name as string);
    add(date, activity.hospitality_inclusions as string);
    add(date, activity.notes as string);
    add(date, activity.transport_notes as string);
  }
  return map;
}

export interface GuestItineraryValidationResult {
  draft: GuestItineraryDraft;
  warnings: string[];
  /** Blocking: confirmed guest-relevant Activity times absent from the narrative. */
  missingTimings: MissingTiming[];
  timingFacts: TimingFact[];
}

/** Staff-facing sentence for a blocking timing gap. */
export function describeMissingTiming(item: MissingTiming): string {
  const where = item.activity_name ? ` (${item.activity_name})` : "";
  switch (item.reason) {
    case "no_day_generated":
      return `${item.date}: no day was generated, so the confirmed ${item.time} time${where} cannot reach guests.`;
    case "badge_only":
      return `${item.date}: ${item.time}${where} appears only as timing metadata. It must be written into the day's narrative — badges are not exported to the PDF.`;
    case "timings_empty":
      return `${item.date}: no timing metadata was recorded even though the Activities contain confirmed times (${item.time}).`;
    default:
      return `${item.date}: the confirmed ${item.time} time${where} is missing from the day's narrative.`;
  }
}

/**
 * Validate a model draft (or a staff-edited draft) against the business
 * constraints the strict wire schema cannot express, and reconcile the generated
 * narrative against the confirmed Activity timing facts in the source context.
 *
 * Throws on a structurally unusable draft. Recoverable issues are returned as
 * staff-facing warnings; timing gaps are returned as blocking `missingTimings`.
 */
export function validateGuestItinerary(
  raw: unknown,
  expected: {
    tourId: string;
    startDate: string;
    endDate: string;
    /** Structured source context. Required for timing reconciliation. */
    sourceContext?: { activities?: AnyRecord[]; itinerary?: AnyRecord } | null;
  },
): GuestItineraryValidationResult {
  if (!raw || typeof raw !== "object") throw new Error("The generated draft was not valid JSON.");
  const draft = raw as GuestItineraryDraft;
  if (!Array.isArray(draft.days) || draft.days.length === 0) {
    throw new Error("The generated draft contained no itinerary days.");
  }
  if (!draft.tour || draft.tour.id !== expected.tourId) {
    throw new Error("The generated draft did not match the selected tour.");
  }

  const warnings: string[] = [];
  const expectedDates = dateRange(expected.startDate, expected.endDate);
  const seen = new Set<string>();

  const usableDays: GuestItineraryDay[] = [];
  for (const day of draft.days) {
    if (!DATE_RE.test(day.date ?? "")) {
      const original = typeof day.date === "string" ? day.date : String(day.date ?? "");
      const understood = coerceDate(day.date);
      const repaired = understood ?? dateForDayNumber(expected.startDate, day.day_number);
      if (!repaired) {
        warnings.push(
          `A generated day had an unreadable date (${original || "blank"}) and was removed. Add this day manually before saving.`,
        );
        continue;
      }
      if (!understood) {
        warnings.push(
          `Day ${day.day_number} had an unreadable date (${original || "blank"}) so ${repaired} was derived from the day number. Please confirm it is right.`,
        );
      }
      day.date = repaired;
    }
    usableDays.push(day);
    if (seen.has(day.date)) warnings.push(`More than one day was generated for ${day.date}.`);
    seen.add(day.date);
    if (!expectedDates.includes(day.date)) {
      warnings.push(`${day.date} falls outside the tour dates and should be removed before saving.`);
    }
    if (!day.title?.trim()) warnings.push(`Day ${day.day_number} has no title.`);
    if (!day.meals?.trim()) warnings.push(`Day ${day.day_number} has no meals line.`);
    if (!day.transport?.trim()) warnings.push(`Day ${day.day_number} has no transport line.`);
    // Transport must be mode only: one short sentence, no times or locations.
    const transport = day.transport ?? "";
    const sentences = transport.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length > 1 || /\d{1,2}[:.]\d{2}\s*(am|pm)?/i.test(transport)) {
      warnings.push(
        `Day ${day.day_number} transport line includes timing or extra detail and should state the mode only.`,
      );
    }
    const paragraphs = (day.narrative_paragraphs ?? []).filter((p) => !!p?.trim());
    if (paragraphs.length === 0) warnings.push(`Day ${day.day_number} has no narrative.`);
    if (paragraphs.length > 2) warnings.push(`Day ${day.day_number} has more than two narrative paragraphs.`);
    day.narrative_paragraphs = paragraphs;
    day.timings = (day.timings ?? []).filter((t) => !!t && typeof t.time === "string");
    for (const t of day.timings) {
      const normalised = normaliseTimeValue(t.time);
      if (normalised) {
        t.time = normalised;
      } else {
        warnings.push(
          `Day ${day.day_number} has a timing that is not a clock time (${t.label ? `${t.label}: ` : ""}${t.time}). Check it in the source Activity or Itinerary entry.`,
        );
      }
    }
    day.warnings = Array.isArray(day.warnings) ? day.warnings : [];
  }

  draft.days = usableDays;
  if (draft.days.length === 0) {
    throw new Error("The generated draft contained no usable itinerary days.");
  }

  const missing = expectedDates.filter((d) => !seen.has(d));
  if (missing.length) {
    warnings.push(`No day was generated for: ${missing.join(", ")}.`);
  }

  draft.days.sort((a, b) => a.date.localeCompare(b.date));
  draft.unresolved_items = Array.isArray(draft.unresolved_items) ? draft.unresolved_items : [];
  draft.generation_summary = draft.generation_summary ?? {
    complete_date_coverage: missing.length === 0,
    source_activity_count: 0,
    source_itinerary_entry_count: 0,
    source_hotel_count: 0,
  };
  draft.generation_summary.complete_date_coverage = missing.length === 0;

  // ---- Timing reconciliation against the structured source context ----
  let timingFacts: TimingFact[] = [];
  let missingTimings: MissingTiming[] = [];
  if (expected.sourceContext) {
    timingFacts = expectedTimingFacts({
      startDate: expected.startDate,
      endDate: expected.endDate,
      activities: expected.sourceContext.activities ?? [],
    });
    const reconciled = reconcileNarrativeTimings(draft.days, timingFacts);
    missingTimings = reconciled.missing;
    warnings.push(...reconciled.warnings);
    warnings.push(...missingTimings.map(describeMissingTiming));
    warnings.push(
      ...detectContentConflicts(draft.days, buildSourceTextByDate(expected.sourceContext)),
    );
  }

  return { draft, warnings, missingTimings, timingFacts };
}
