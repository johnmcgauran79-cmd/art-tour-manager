import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, Loader2, Check } from "lucide-react";
import { useUpdateTask } from "@/hooks/useTaskMutations";
import { formatDistanceToNow } from "date-fns";

interface TaskQuickUpdateProps {
  taskId: string;
  currentUpdate: string | null;
  updatedAt: string | null;
}

export const TaskQuickUpdate = ({ taskId, currentUpdate, updatedAt }: TaskQuickUpdateProps) => {
  const [value, setValue] = useState(currentUpdate || "");
  const [justSaved, setJustSaved] = useState(false);
  const updateTask = useUpdateTask();

  useEffect(() => {
    setValue(currentUpdate || "");
  }, [currentUpdate]);

  const handleBlur = async () => {
    const trimmed = value.trim();
    const original = (currentUpdate || "").trim();
    if (trimmed === original) return;
    await updateTask.mutateAsync({
      taskId,
      updates: { quick_update: trimmed || null } as any,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Quick update</h4>
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              · {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {updateTask.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          ) : justSaved ? (
            <>
              <Check className="h-3 w-3 text-success" /> Saved
            </>
          ) : null}
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Share a quick status update for the team..."
        rows={2}
      />
    </div>
  );
};
