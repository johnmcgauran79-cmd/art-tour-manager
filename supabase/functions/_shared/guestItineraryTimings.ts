// Timing grounding for the Guest Document itinerary skill.
//
// The client-facing PDF must read as prose, so every confirmed guest-relevant
// Activity time has to be woven into narrative_paragraphs. Timing badges are
// audit metadata only and are NOT exported to the PDF, so a badge can never
// stand in for a time that is missing from the narrative.
import { coerceDate, extractClockTimes, normaliseTimeValue } from "./guestItineraryTime.ts";

export type TimingStatus = "confirmed" | "tentative";

export interface TimingFact {
  date: string;
  label: string;
  time: string;
  status: TimingStatus;
  source_type: "activity";
  source_id: string | null;
  field: "depart_for_activity" | "start_time" | "end_time" | "pickup" | "notes" | "transport_notes";
  /** Confirmed and guest relevant: it must appear in that day's narrative. */
  required: boolean;
  activity_name: string | null;
}

export interface MissingTiming {
  date: string;
  label: string;
  time: string;
  activity_name: string | null;
  reason: "no_day_generated" | "absent_from_narrative" | "badge_only" | "timings_empty";
}

const CONFIRMED_STATUSES = new Set([
  "booked",
  "paid_deposit",
  "fully_paid",
  "confirmed",
  "finalised",
]);
const CANCELLED_STATUSES = new Set(["cancelled"]);

const TENTATIVE_RE = /\b(maybe|possibly|proposed|provisional|subject to confirmation|tbc|tba|to be confirmed|to be advised|if available|awaiting)\b/i;

const GUEST_RELEVANT_RE =
  /\b(meet|meeting|assemble|gather|regroup|regrouping|depart|departure|leave|pick[\s-]?up|collect|check[\s-]?in|check[\s-]?out|flight|plane|board|boarding|train|ktx|coach|bus|transfer|arrive|arrival|return|drinks|breakfast|lunch|dinner|race|racing|first race|tour|cruise|show)\b/i;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Split free text into sentence-like fragments so tentative wording stays local. */
function fragments(text: string): string[] {
  return text
    .split(/(?:[.!?;\n])+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstTime(value: unknown): string | null {
  const norm = normaliseTimeValue(value);
  if (norm) return norm.split(/\s+to\s+/i)[0];
  const found = extractClockTimes(value);
  return found[0] ?? null;
}

/**
 * The timing facts the narrative is expected to carry, derived from the tour's
 * in-range Activity records only. Tentative facts are returned too (so staff can
 * be warned) but are never `required`.
 */
export function expectedTimingFacts(args: {
  startDate: string;
  endDate: string;
  activities: Record<string, unknown>[];
}): TimingFact[] {
  const facts: TimingFact[] = [];
  for (const activity of args.activities ?? []) {
    if (!activity || typeof activity !== "object") continue;
    const date = coerceDate(activity.activity_date);
    if (!date || date < args.startDate || date > args.endDate) continue;
    const bookingStatus = (str(activity.booking_status) ?? "").toLowerCase();
    if (CANCELLED_STATUSES.has(bookingStatus)) continue;
    const activityConfirmed = bookingStatus === "" || CONFIRMED_STATUSES.has(bookingStatus);
    const name = str(activity.name);
    const sourceId = str(activity.id);

    const push = (
      field: TimingFact["field"],
      label: string,
      rawTime: unknown,
      tentative: boolean,
      guestRelevant: boolean,
    ) => {
      const time = firstTime(rawTime);
      if (!time) return;
      const status: TimingStatus = tentative || !activityConfirmed ? "tentative" : "confirmed";
      if (facts.some((f) => f.date === date && f.time === time && f.field === field && f.source_id === sourceId)) {
        return;
      }
      facts.push({
        date,
        label,
        time,
        status,
        source_type: "activity",
        source_id: sourceId,
        field,
        required: status === "confirmed" && guestRelevant,
        activity_name: name,
      });
    };

    const activityLabel = name ?? "activity";
    push("depart_for_activity", `Depart for ${activityLabel}`, activity.depart_for_activity, false, true);
    push("start_time", `${activityLabel} begins`, activity.start_time, false, true);
    push("end_time", `${activityLabel} concludes`, activity.end_time, false, true);

    const textFields: { field: TimingFact["field"]; value: unknown }[] = [
      { field: "pickup", value: activity.pickup_location_transport },
      { field: "notes", value: activity.notes },
      { field: "transport_notes", value: activity.transport_notes },
    ];
    for (const { field, value } of textFields) {
      const text = str(value);
      if (!text) continue;
      for (const fragment of fragments(text)) {
        const times = extractClockTimes(fragment);
        if (!times.length) continue;
        const tentative = TENTATIVE_RE.test(fragment);
        const guestRelevant = GUEST_RELEVANT_RE.test(fragment);
        for (const time of times) {
          push(field, `${activityLabel}: ${fragment.slice(0, 90)}`, time, tentative, guestRelevant);
        }
      }
    }
  }
  return facts;
}

export interface NarrativeDay {
  day_number?: number;
  date?: string;
  title?: string;
  meals?: string;
  transport?: string;
  narrative_paragraphs?: string[];
  timings?: { label?: string; time?: string; status?: string }[];
  warnings?: string[];
}

/** Every clock time present in a day's client-facing prose. */
export function narrativeTimes(day: NarrativeDay): Set<string> {
  const text = [
    ...(day.narrative_paragraphs ?? []),
    day.title ?? "",
    day.meals ?? "",
  ].join("\n");
  return new Set(extractClockTimes(text));
}

/**
 * Reconcile a generated (or staff-edited) set of days against the expected
 * Activity timing facts.
 *
 * `missing` is blocking: the draft must not be saved while it is non-empty.
 */
export function reconcileNarrativeTimings(
  days: NarrativeDay[],
  facts: TimingFact[],
): { missing: MissingTiming[]; warnings: string[] } {
  const missing: MissingTiming[] = [];
  const warnings: string[] = [];
  const byDate = new Map<string, NarrativeDay>();
  for (const day of days ?? []) {
    const date = coerceDate(day?.date);
    if (date) byDate.set(date, day);
  }

  const requiredByDate = new Map<string, TimingFact[]>();
  for (const fact of facts) {
    if (!fact.required) continue;
    const list = requiredByDate.get(fact.date) ?? [];
    list.push(fact);
    requiredByDate.set(fact.date, list);
  }

  for (const [date, required] of requiredByDate) {
    const day = byDate.get(date);
    if (!day) {
      for (const fact of required) {
        missing.push({
          date,
          label: fact.label,
          time: fact.time,
          activity_name: fact.activity_name,
          reason: "no_day_generated",
        });
      }
      continue;
    }
    const prose = narrativeTimes(day);
    const badges = new Set(
      (day.timings ?? [])
        .map((t) => normaliseTimeValue(t?.time))
        .filter((t): t is string => !!t)
        .flatMap((t) => t.split(/\s+to\s+/i)),
    );
    // Timing badges are audit metadata and are not exported to the PDF, so an
    // empty timings array cannot pass when the source has confirmed times.
    if (badges.size === 0) {
      missing.push({
        date,
        label: "Timing audit metadata",
        time: required.map((f) => f.time).join(", "),
        activity_name: null,
        reason: "timings_empty",
      });
    }
    for (const fact of required) {
      if (prose.has(fact.time)) continue;
      missing.push({
        date,
        label: fact.label,
        time: fact.time,
        activity_name: fact.activity_name,
        reason: badges.has(fact.time) ? "badge_only" : "absent_from_narrative",
      });
    }
  }

  // Tentative times must stay in staff warnings, never in client prose.
  for (const fact of facts) {
    if (fact.status !== "tentative") continue;
    const day = byDate.get(fact.date);
    if (!day) continue;
    if (narrativeTimes(day).has(fact.time)) {
      warnings.push(
        `${fact.date}: ${fact.time} is not confirmed in ${fact.activity_name ?? "the Activity"} but appears in the guest narrative. Confirm the Activity or remove the time.`,
      );
    }
  }

  return { missing, warnings };
}

const MEAL_WORDS = ["breakfast", "lunch", "dinner"] as const;
const NEGATED_RE =
  /\b(no|not|without|excluded|not included|own arrangements|at your own|own expense)\b/i;

/**
 * The sentence containing the first mention of `word`. Negation only carries
 * within a sentence — "Breakfast at the hotel. No group meal this evening."
 * does not exclude breakfast.
 */
function sentenceContaining(text: string, word: string): string {
  const re = new RegExp(`\\b${word}\\b`);
  for (const sentence of text.split(/(?<=[.!?;])\s+|\n+/)) {
    if (re.test(sentence)) return sentence;
  }
  return "";
}

/**
 * Guard against a meal or transfer being presented as confirmed when the current
 * Itinerary or Activities do not support it — or explicitly exclude it.
 */
export function detectContentConflicts(
  days: NarrativeDay[],
  sourceTextByDate: Map<string, string>,
): string[] {
  const warnings: string[] = [];
  for (const day of days ?? []) {
    const date = coerceDate(day?.date);
    if (!date) continue;
    const source = (sourceTextByDate.get(date) ?? "").toLowerCase();
    if (!source) continue;
    const claimed = `${day.meals ?? ""} ${day.narrative_paragraphs?.join(" ") ?? ""}`.toLowerCase();
    for (const meal of MEAL_WORDS) {
      if (!new RegExp(`\\b${meal}\\b`).test(claimed)) continue;
      if (NEGATED_RE.test(sentenceContaining(claimed, meal))) {
        continue; // "no dinner included" is a correct statement, not a claim.
      }
      const mentioned = new RegExp(`\\b${meal}\\b`).test(source);
      if (!mentioned) {
        warnings.push(
          `${date}: ${meal} is presented to guests but no Itinerary entry or Activity inclusion for that day mentions it. Confirm the inclusion or remove it.`,
        );
        continue;
      }
      if (NEGATED_RE.test(sentenceContaining(source, meal))) {
        warnings.push(
          `${date}: the source says ${meal} is not included, but the draft presents it as included. Resolve the conflict before saving.`,
        );
      }
    }
  }
  return warnings;
}
