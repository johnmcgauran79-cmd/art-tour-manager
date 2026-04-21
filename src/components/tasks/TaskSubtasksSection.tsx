import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { useTaskSubtasks, useCreateSubtask, useToggleSubtask, useDeleteSubtask } from "@/hooks/useTaskSubtasks";
import { Progress } from "@/components/ui/progress";

interface TaskSubtasksSectionProps {
  taskId: string;
}

export const TaskSubtasksSection = ({ taskId }: TaskSubtasksSectionProps) => {
  const { data: subtasks, isLoading } = useTaskSubtasks(taskId);
  const createSubtask = useCreateSubtask();
  const toggleSubtask = useToggleSubtask();
  const deleteSubtask = useDeleteSubtask();
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createSubtask.mutateAsync({ task_id: taskId, title: newTitle.trim() });
    setNewTitle("");
  };

  const total = subtasks?.length || 0;
  const completed = subtasks?.filter(s => s.completed).length || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <h4 className="font-medium text-sm">Subtasks {total > 0 && <span className="text-muted-foreground">({completed}/{total})</span>}</h4>
        </div>
      </div>

      {total > 0 && <Progress value={pct} className="h-1.5" />}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-1">
          {subtasks?.map(st => (
            <div key={st.id} className="flex items-center gap-2 group hover:bg-accent/40 rounded px-2 py-1">
              <Checkbox
                checked={st.completed}
                onCheckedChange={(checked) => toggleSubtask.mutate({ id: st.id, task_id: taskId, completed: !!checked })}
              />
              <span className={`flex-1 text-sm ${st.completed ? 'line-through text-muted-foreground' : ''}`}>
                {st.title}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => deleteSubtask.mutate({ id: st.id, task_id: taskId })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Add a subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          className="h-9"
        />
        <Button onClick={handleAdd} size="sm" disabled={!newTitle.trim() || createSubtask.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
