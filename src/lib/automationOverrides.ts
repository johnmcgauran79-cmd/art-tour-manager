/**
 * Shared constants and helpers for the manual-handling automation override system.
 *
 * Tours have two flags: `manual_billing` (skip Xero+Keap) and `manual_emails`
 * (skip automated emails). Bookings inherit by default but can override via
 * `automation_override`.
 */

export type BookingAutomationOverride =
  | "inherit"
  | "force_automated"
  | "manual_billing"
  | "manual_emails"
  | "manual_all";

export const BOOKING_AUTOMATION_OVERRIDE_OPTIONS: {
  value: BookingAutomationOverride;
  label: string;
  description: string;
}[] = [
  {
    value: "inherit",
    label: "Inherit from tour",
    description: "Follow whatever the tour is set to (default).",
  },
  {
    value: "force_automated",
    label: "Force automated",
    description: "Always run Xero, Keap and automated emails — even if the tour is manual.",
  },
  {
    value: "manual_billing",
    label: "Manual billing only",
    description: "Skip Xero invoice and Keap tag for this booking. Automated emails still send.",
  },
  {
    value: "manual_emails",
    label: "Manual emails only",
    description: "Skip automated emails for this booking. Xero and Keap still run.",
  },
  {
    value: "manual_all",
    label: "Fully manual",
    description: "Skip Xero, Keap and automated emails for this booking.",
  },
];

/**
 * Compute whether billing automation (Xero invoice + Keap tag) should be skipped
 * for a booking, given the tour's flags and the booking's override.
 */
export const bookingSkipsBilling = (
  tour: { manual_billing?: boolean | null } | null | undefined,
  override: BookingAutomationOverride | null | undefined
): boolean => {
  if (override === "force_automated") return false;
  if (override === "manual_billing" || override === "manual_all") return true;
  return !!tour?.manual_billing;
};

/**
 * Compute whether automated email sending should be skipped for a booking.
 */
export const bookingSkipsEmails = (
  tour: { manual_emails?: boolean | null } | null | undefined,
  override: BookingAutomationOverride | null | undefined
): boolean => {
  if (override === "force_automated") return false;
  if (override === "manual_emails" || override === "manual_all") return true;
  return !!tour?.manual_emails;
};

/**
 * Short human label for indicator tooltips.
 */
export const tourManualSummary = (tour: {
  manual_billing?: boolean | null;
  manual_emails?: boolean | null;
}): string | null => {
  const parts: string[] = [];
  if (tour.manual_billing) parts.push("Billing");
  if (tour.manual_emails) parts.push("Emails");
  if (parts.length === 0) return null;
  return `Manual handling: ${parts.join(" + ")}`;
};

export const overrideShortLabel = (
  override: BookingAutomationOverride | null | undefined
): string | null => {
  if (!override || override === "inherit") return null;
  return BOOKING_AUTOMATION_OVERRIDE_OPTIONS.find((o) => o.value === override)?.label ?? null;
};