// ART AI quick-skill catalogue. Drives the landing page cards.
// - deterministic: server-orchestrated skill (Explain Booking / Explain Client)
// - generic: launches a curated prompt into the bounded generic MCP chat loop
// - coming_soon: visually disabled, makes NO request

export type QuickSkillKind = "deterministic" | "generic" | "coming_soon";
export type SkillGroup = "Operations" | "Finance" | "Administration";

/** Deterministic, server-orchestrated skills. */
export type DeterministicSkillId =
  | "explain_booking"
  | "explain_client"
  | "payment_exceptions_for_next_departing_tour";

export interface QuickSkill {
  id: string;
  label: string;
  description: string;
  group: SkillGroup;
  kind: QuickSkillKind;
  /** deterministic skills */
  skillId?: DeterministicSkillId;
  /** deterministic skills that require on-page record context (booking/customer). */
  requiresContext?: boolean;
  /** generic skills — curated prompt sent to the generic chat loop */
  prompt?: string;
  /** deterministic skills launched from the landing page (no record context) */
  landingPrompt?: string;
}

export const QUICK_SKILLS: QuickSkill[] = [
  // ---- Operations ----
  {
    id: "explain_booking",
    label: "Explain Booking",
    description: "A clear operational summary of a booking. Open a booking and use the Explain button, or describe it here.",
    group: "Operations",
    kind: "deterministic",
    skillId: "explain_booking",
    requiresContext: true,
    landingPrompt:
      "I want to understand a specific booking. Ask me for the tour and lead passenger, then look it up and summarise it.",
  },
  {
    id: "explain_client",
    label: "Explain Client",
    description: "A summary of a contact and their tour relationship. Open a contact and use the Explain button, or describe them here.",
    group: "Operations",
    kind: "deterministic",
    skillId: "explain_client",
    requiresContext: true,
    landingPrompt:
      "I want to understand a specific client. Ask me for their name or email, then look them up and summarise their bookings.",
  },
  // ---- Finance ----
  {
    id: "payment_exceptions",
    label: "Payment exceptions for next tour",
    description: "Deterministically finds the next departing tour and lists bookings behind on their expected payment stage.",
    group: "Finance",
    kind: "deterministic",
    skillId: "payment_exceptions_for_next_departing_tour",
    requiresContext: false,
  },
  {
    id: "explain_invoice",
    label: "Explain Invoice",
    description: "Explain a booking's live Xero invoice and payment position.",
    group: "Finance",
    kind: "generic",
    prompt: "Explain the payment position for a booking. Ask me which booking, then look it up in Xero.",
  },
  {
    id: "compare_art_xero",
    label: "Compare ART and Xero",
    description: "Reconcile ART payment status against live Xero for a tour.",
    group: "Finance",
    kind: "generic",
    prompt: "Compare the ART payment report to Xero for our next departing tour and highlight any discrepancies.",
  },
  {
    id: "outstanding_balances",
    label: "Outstanding Balances",
    description: "Bookings with outstanding invoices.",
    group: "Finance",
    kind: "generic",
    prompt: "Which bookings have outstanding invoices right now?",
  },
  {
    id: "invoice_mapping_issues",
    label: "Invoice Mapping Issues",
    description: "Flag bookings whose linked Xero invoice is deleted/voided or disagrees with the invoice reference.",
    group: "Finance",
    kind: "generic",
    prompt:
      "Audit our bookings for invoice mapping issues: list any where the mapped Xero invoice is deleted or voided, or where it disagrees with the booking's invoice reference.",
  },
  // ---- Administration ----
  {
    id: "summarise_tour",
    label: "Summarise Tour",
    description: "An operational overview of a tour.",
    group: "Administration",
    kind: "generic",
    prompt: "Summarise our next departing tour: dates, capacity, bookings and host.",
  },
  {
    id: "summarise_itinerary",
    label: "Summarise Itinerary",
    description: "A day-by-day itinerary summary.",
    group: "Administration",
    kind: "generic",
    prompt: "Summarise the itinerary for our next departing tour.",
  },
  {
    id: "review_missing_forms",
    label: "Review Missing Forms",
    description: "Custom forms still awaiting responses.",
    group: "Administration",
    kind: "generic",
    prompt: "Which custom forms are still awaiting responses for our upcoming tours?",
  },
];

export const COMING_SOON_SKILLS: { id: string; label: string; description: string; group: SkillGroup }[] = [
  { id: "tour_readiness", label: "Tour Readiness", description: "Checklist of what's outstanding before a tour departs.", group: "Operations" },
  { id: "prepare_host_brief", label: "Prepare Host Brief", description: "A briefing pack for the assigned tour host.", group: "Operations" },
  { id: "daily_ops_brief", label: "Daily Operations Brief", description: "A daily operational summary across all active tours.", group: "Operations" },
  { id: "draft_operational_email", label: "Draft Operational Email", description: "Draft an operational email for review.", group: "Administration" },
];

export const SKILL_LAUNCH_PROMPTS: Record<string, string> = {
  explain_booking: "Explain this booking.",
  explain_client: "Explain this client.",
  payment_exceptions_for_next_departing_tour:
    "Show payment exceptions for our next departing tour.",
};