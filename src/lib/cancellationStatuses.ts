export const CANCELLATION_REFUND_STATUS_OPTIONS = [
  { value: "waiting_for_refund", label: "Waiting for Refund" },
  { value: "cancellation_processed", label: "Cancellation Processed" },
  { value: "cash_refund_received", label: "Cash Refund Received" },
  { value: "credit_received", label: "Credit Received" },
  { value: "no_refund", label: "No Refund" },
] as const;

export type CancellationRefundStatus =
  (typeof CANCELLATION_REFUND_STATUS_OPTIONS)[number]["value"];

export const NONE_CANCELLATION_STATUS = "__none__";