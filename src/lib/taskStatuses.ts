/**
 * Centralized task status definitions.
 * Order here is the order shown in pickers and used for sorting.
 */
export interface TaskStatusOption {
  value: string;
  label: string;
}

export const TASK_STATUS_OPTIONS: TaskStatusOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "awaiting_further_information", label: "Awaiting Further Information" },
  { value: "with_third_party", label: "With Third Party" },
  { value: "not_required", label: "Not Required" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

export const TASK_STATUS_RANK: Record<string, number> = TASK_STATUS_OPTIONS.reduce(
  (acc, opt, idx) => {
    acc[opt.value] = idx;
    return acc;
  },
  {} as Record<string, number>,
);

export const formatTaskStatus = (status: string): string => {
  const found = TASK_STATUS_OPTIONS.find((o) => o.value === status);
  if (found) return found.label;
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};