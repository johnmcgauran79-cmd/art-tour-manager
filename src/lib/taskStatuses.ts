/**
 * Centralized task status definitions.
 * Order here is the order shown in pickers and used for sorting.
 */
export interface TaskStatusOption {
  value: string;
  label: string;
  is_finished?: boolean;
  sort_order?: number;
}

const DEFAULT_TASK_STATUS_OPTIONS: TaskStatusOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "not_required", label: "Not Required" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "awaiting_further_information", label: "Awaiting Further Information" },
  { value: "with_third_party", label: "With Third Party" },
  { value: "approval_required", label: "Approval Required" },
  { value: "approved", label: "Approved" },
  { value: "changes_needed", label: "Changes Needed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

// Mutable cache populated by the useTaskStatuses hook so consumers using
// these synchronous helpers stay in sync with admin-managed statuses.
let cachedStatuses: TaskStatusOption[] = [...DEFAULT_TASK_STATUS_OPTIONS];
let cachedFinished: Set<string> = new Set(["completed", "cancelled", "archived", "not_required"]);

export const TASK_STATUS_OPTIONS = new Proxy([] as TaskStatusOption[], {
  get(_t, prop) {
    return Reflect.get(cachedStatuses, prop);
  },
  has(_t, prop) {
    return Reflect.has(cachedStatuses, prop);
  },
  ownKeys() {
    return Reflect.ownKeys(cachedStatuses);
  },
  getOwnPropertyDescriptor(_t, prop) {
    return Reflect.getOwnPropertyDescriptor(cachedStatuses, prop);
  },
}) as TaskStatusOption[];

export const setTaskStatusesCache = (statuses: TaskStatusOption[]) => {
  if (!statuses?.length) return;
  cachedStatuses = statuses;
  cachedFinished = new Set(statuses.filter((s) => s.is_finished).map((s) => s.value));
};

export const TASK_STATUS_RANK: Record<string, number> = new Proxy(
  {} as Record<string, number>,
  {
    get(_t, prop: string) {
      const idx = cachedStatuses.findIndex((o) => o.value === prop);
      return idx === -1 ? 999 : idx;
    },
  },
);

export const formatTaskStatus = (status: string): string => {
  const found = cachedStatuses.find((o) => o.value === status);
  if (found) return found.label;
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export const isTaskFinished = (status: string | null | undefined): boolean =>
  !!status && cachedFinished.has(status);