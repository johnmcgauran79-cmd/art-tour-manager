import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useUpdateTask } from "@/hooks/useTaskMutations";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  value: string | null;
  canEdit: boolean;
}

/**
 * Inline-editable single-line "quick update" cell.
 * Click to edit, Enter to save, Escape to cancel.
 */
export const TaskLatestCell = ({ taskId, value, canEdit }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateTask = useUpdateTask();

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value ?? "").trim()) {
      updateTask.mutate({
        taskId,
        updates: { quick_update: next || null } as any,
        silent: true,
      });
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder="Add a quick update…"
        className="w-full bg-background border border-primary/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (canEdit) setEditing(true);
      }}
      className={cn(
        "w-full text-left text-xs truncate px-2 py-1 rounded border border-transparent",
        canEdit && "hover:border-border hover:bg-accent/40 cursor-text",
        !value && "text-muted-foreground italic",
      )}
      title={value || "Click to add quick update"}
    >
      {value || (canEdit ? "Add update…" : "—")}
    </button>
  );
};
