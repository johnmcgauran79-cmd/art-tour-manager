/**
 * Centralized Booking Status & Payment Status definitions for
 * Hotels and Activities (the "workflow" statuses).
 *
 * These are separate from the booking-record status used on bookings.
 */

export interface WorkflowStatusOption {
  value: string;
  label: string;
}

// Booking workflow status (operational lifecycle for hotel / activity arrangements)
export const BOOKING_WORKFLOW_STATUS_OPTIONS: WorkflowStatusOption[] = [
  { value: "pending", label: "Pending" },
  { value: "enquiry_sent", label: "Enquiry Sent" },
  { value: "quote_received", label: "Quote Received" },
  { value: "on_hold", label: "On Hold / Provisional Booking" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "finalised", label: "Finalised" },
  { value: "cancelled", label: "Cancelled" },
];

// Payment workflow status (financial state, independent of booking)
export const PAYMENT_WORKFLOW_STATUS_OPTIONS: WorkflowStatusOption[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "fully_paid", label: "Fully Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const findLabel = (
  options: WorkflowStatusOption[],
  value: string | null | undefined,
): string => {
  if (!value) return "";
  const found = options.find((o) => o.value === value);
  if (found) return found.label;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export const formatBookingWorkflowStatus = (
  status: string | null | undefined,
): string => findLabel(BOOKING_WORKFLOW_STATUS_OPTIONS, status);

export const formatPaymentWorkflowStatus = (
  status: string | null | undefined,
): string => findLabel(PAYMENT_WORKFLOW_STATUS_OPTIONS, status);

/**
 * Tailwind color classes for badges. Uses standard tokens so the system
 * stays themeable; these reuse the same palette as other status badges.
 */
export const getBookingWorkflowStatusColor = (
  status: string | null | undefined,
): string => {
  const map: Record<string, string> = {
    pending: "bg-status-pending text-status-pending-foreground",
    enquiry_sent: "bg-status-pending text-status-pending-foreground",
    quote_received: "bg-status-waiting text-status-waiting-foreground",
    on_hold: "bg-status-waiting text-status-waiting-foreground",
    booked: "bg-status-deposited text-status-deposited-foreground",
    confirmed: "bg-status-fully-paid text-status-fully-paid-foreground",
    finalised: "bg-status-completed text-status-completed-foreground",
    cancelled: "bg-status-cancelled text-status-cancelled-foreground",
  };
  return map[status || "pending"] || map.pending;
};

export const getPaymentWorkflowStatusColor = (
  status: string | null | undefined,
): string => {
  const map: Record<string, string> = {
    unpaid: "bg-status-pending text-status-pending-foreground",
    partially_paid: "bg-status-instalment-paid text-status-instalment-paid-foreground",
    fully_paid: "bg-status-fully-paid text-status-fully-paid-foreground",
    cancelled: "bg-status-cancelled text-status-cancelled-foreground",
  };
  return map[status || "unpaid"] || map.unpaid;
};