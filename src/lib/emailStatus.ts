export interface EmailEvent {
  event_type: string;
  created_at?: string;
}

export interface EmailLogLike {
  error_message?: string | null;
  email_events?: EmailEvent[] | null;
}

export type EmailStatusLabel =
  | "Sent"
  | "Delivered"
  | "Opened"
  | "Bounced"
  | "Complained"
  | "Failed";

export interface EmailStatus {
  delivered: boolean;
  opened: boolean;
  bounced: boolean;
  complained: boolean;
  hasIssue: boolean;
  label: EmailStatusLabel;
  lastOpenedAt: string | null;
}

/**
 * Derive a human-friendly status for a sent email from its Resend events.
 * Shared by the Sent Emails Report and the per-booking / per-contact
 * Communications timelines.
 */
export const computeEmailStatus = (log: EmailLogLike): EmailStatus => {
  const events = log.email_events || [];
  const types = new Set(events.map((e) => e.event_type));
  const bounced = types.has("bounced");
  const complained = types.has("complained");
  const opened = types.has("opened");
  const delivered = types.has("delivered");
  const failed = !!log.error_message;

  let label: EmailStatusLabel = "Sent";
  if (failed) label = "Failed";
  else if (bounced) label = "Bounced";
  else if (complained) label = "Complained";
  else if (opened) label = "Opened";
  else if (delivered) label = "Delivered";

  const openEvents = events
    .filter((e) => e.event_type === "opened" && e.created_at)
    .map((e) => e.created_at as string)
    .sort();
  const lastOpenedAt = openEvents.length ? openEvents[openEvents.length - 1] : null;

  return {
    delivered,
    opened,
    bounced,
    complained,
    hasIssue: bounced || complained || failed,
    label,
    lastOpenedAt,
  };
};

export const emailStatusBadgeVariant = (
  label: EmailStatusLabel
): "default" | "secondary" | "destructive" | "outline" => {
  switch (label) {
    case "Opened":
      return "default";
    case "Bounced":
    case "Complained":
    case "Failed":
      return "destructive";
    case "Delivered":
      return "secondary";
    default:
      return "outline";
  }
};