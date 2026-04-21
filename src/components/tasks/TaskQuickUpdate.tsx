import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit3, Save, X } from "lucide-react";
import { useUpdateTask } from "@/hooks/useTaskMutations";
import { formatDistanceToNow } from "date-fns";

interface TaskQuickUpdateProps {
  taskId: string;
  currentUpdate: string | null;
  updatedAt: string | null;
}

export const TaskQuickUpdate = ({ taskId, currentUpdate, updatedAt }: TaskQuickUpdateProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUpdate || "");
  const updateTask = useUpdateTask();

  useEffect(() => {
    setValue(currentUpdate || "");
  }, [currentUpdate]);

  const handleSave = async () => {
    await updateTask.mutateAsync({ taskId, updates: { quick_update: value || null } as any });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Quick update</h4>
          {updatedAt && !editing && (
            <span className="text-xs text-muted-foreground">
              · {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {currentUpdate ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Share a quick status update for the team..."
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setValue(currentUpdate || ""); setEditing(false); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateTask.isPending}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {currentUpdate || "No recent update."}
        </p>
      )}
    </div>
  );
};
