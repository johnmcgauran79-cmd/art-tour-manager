/** Shared CRM vocabulary for leads, activities and relationships. */

export const LEAD_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "voicemail", label: "Voicemail" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "preference", label: "Client preference" },
  { value: "follow_up", label: "Follow-up" },
  { value: "complaint", label: "Complaint / issue" },
  { value: "other", label: "Other" },
] as const;

export const ACTIVITY_DIRECTIONS = [
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
] as const;

export const ACTIVITY_OUTCOMES = [
  { value: "spoke", label: "Spoke with them" },
  { value: "left_message", label: "Left a message" },
  { value: "no_answer", label: "No answer" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "info_sent", label: "Information sent" },
  { value: "callback_requested", label: "Callback requested" },
  { value: "not_interested", label: "Not interested" },
  { value: "other", label: "Other" },
] as const;

export const RELATIONSHIP_TYPES = [
  { value: "spouse_partner", label: "Spouse / partner" },
  { value: "friend", label: "Friend" },
  { value: "family", label: "Family" },
  { value: "travels_with", label: "Travels with" },
  { value: "referred_by", label: "Referred by" },
  { value: "referrer", label: "Referrer" },
  { value: "business", label: "Business relationship" },
  { value: "other", label: "Other" },
] as const;

export const INTEREST_LEVELS = [
  { value: "watching", label: "Watching" },
  { value: "interested", label: "Interested" },
  { value: "keen", label: "Keen" },
] as const;

export const INTEREST_STATUSES = [
  { value: "interested", label: "Interested" },
  { value: "booked", label: "Booked" },
  { value: "lapsed", label: "Lapsed" },
] as const;

export const labelFor = (
  list: readonly { value: string; label: string }[],
  value?: string | null
) => list.find((i) => i.value === value)?.label || value || "—";

export const priorityBadgeClass = (priority?: string | null) => {
  switch (priority) {
    case "urgent":
      return "bg-destructive text-destructive-foreground";
    case "high":
      return "bg-amber-500 text-white";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};
