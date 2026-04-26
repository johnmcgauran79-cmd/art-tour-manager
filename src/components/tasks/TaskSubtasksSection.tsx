import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ListChecks, CalendarIcon, User as UserIcon, MessageSquare } from "lucide-react";
import {
  useTaskSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  useUpdateSubtask,
  TaskSubtask,
} from "@/hooks/useTaskSubtasks";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubtaskUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface TaskSubtasksSectionProps {
  taskId: string;
  defaultAssigneeId?: string | null;
}

const userLabel = (u?: SubtaskUser | null) => {
  if (!u) return "Unassigned";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email || "Unknown";
};

export const TaskSubtasksSection = ({ taskId, defaultAssigneeId }: TaskSubtasksSectionProps) => {
  const { data: subtasks, isLoading } = useTaskSubtasks(taskId);
  const createSubtask = useCreateSubtask();
  const toggleSubtask = useToggleSubtask();
  const deleteSubtask = useDeleteSubtask();
  const updateSubtask = useUpdateSubtask();
  const [newTitle, setNewTitle] = useState("");

  // Only Admin and Manager users can be assigned to subtasks.
  const { data: users } = useAssignableUsers();

  const usersById = new Map((users || []).map((u) => [u.id, u]));

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createSubtask.mutateAsync({
      task_id: taskId,
      title: newTitle.trim(),
      assignee_id: defaultAssigneeId ?? null,
    });
    setNewTitle("");
  };

  const total = subtasks?.length || 0;
  const completed = subtasks?.filter((s) => s.completed).length || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <h4 className="font-medium text-sm">
            Subtasks{" "}
            {total > 0 && (
              <span className="text-muted-foreground">
                ({completed}/{total})
              </span>
            )}
          </h4>
        </div>
      </div>

      {total > 0 && <Progress value={pct} className="h-1.5" />}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {subtasks?.map((st) => (
            <SubtaskRow
              key={st.id}
              subtask={st}
              users={users || []}
              usersById={usersById}
              onToggle={(checked) =>
                toggleSubtask.mutate({ id: st.id, task_id: taskId, completed: checked })
              }
              onDelete={() => deleteSubtask.mutate({ id: st.id, task_id: taskId })}
              onUpdate={(patch) =>
                updateSubtask.mutate({ id: st.id, task_id: taskId, ...patch })
              }
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Add a subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="h-9"
        />
        <Button
          onClick={handleAdd}
          size="sm"
          disabled={!newTitle.trim() || createSubtask.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface SubtaskRowProps {
  subtask: TaskSubtask;
  users: SubtaskUser[];
  usersById: Map<string, SubtaskUser>;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onUpdate: (patch: {
    due_date?: string | null;
    assignee_id?: string | null;
    latest_note?: string | null;
  }) => void;
}

const SubtaskRow = ({
  subtask,
  users,
  usersById,
  onToggle,
  onDelete,
  onUpdate,
}: SubtaskRowProps) => {
  const [noteDraft, setNoteDraft] = useState(subtask.latest_note ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  // Keep local note in sync if the row updates externally
  useEffect(() => {
    setNoteDraft(subtask.latest_note ?? "");
  }, [subtask.latest_note]);

  const assignee = subtask.assignee_id ? usersById.get(subtask.assignee_id) : null;
  const dueDate = subtask.due_date ? parseISO(subtask.due_date) : undefined;

  const commitNote = () => {
    const trimmed = noteDraft.trim();
    const current = subtask.latest_note ?? "";
    if (trimmed === current) return;
    onUpdate({ latest_note: trimmed.length ? trimmed : null });
  };

  return (
    <div className="group rounded border border-border/60 px-3 py-2 hover:bg-accent/30 transition-colors">
      {/* Top row: checkbox + title + meta + delete */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={(checked) => onToggle(!!checked)}
        />
        <span
          className={cn(
            "flex-1 text-sm",
            subtask.completed && "line-through text-muted-foreground"
          )}
        >
          {subtask.title}
        </span>

        {/* Assignee picker */}
        <Select
          value={subtask.assignee_id ?? "unassigned"}
          onValueChange={(val) =>
            onUpdate({ assignee_id: val === "unassigned" ? null : val })
          }
        >
          <SelectTrigger className="h-7 w-auto min-w-[8rem] gap-1 px-2 text-xs">
            <UserIcon className="h-3 w-3 text-muted-foreground" />
            <SelectValue>
              <span className="truncate">{userLabel(assignee)}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {userLabel(u)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 gap-1 px-2 text-xs font-normal",
                !dueDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3 w-3" />
              {dueDate ? format(dueDate, "d MMM yyyy") : "Due date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) =>
                onUpdate({
                  due_date: date ? format(date, "yyyy-MM-dd") : null,
                })
              }
              initialFocus
              className="pointer-events-auto"
            />
            {dueDate && (
              <div className="p-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs"
                  onClick={() => onUpdate({ due_date: null })}
                >
                  Clear due date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete subtask"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Latest note row */}
      <div className="flex items-center gap-2 mt-1.5 pl-6">
        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
        <Input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onFocus={() => setNoteOpen(true)}
          onBlur={() => {
            setNoteOpen(false);
            commitNote();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setNoteDraft(subtask.latest_note ?? "");
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Latest update..."
          className="h-7 text-xs border-transparent bg-transparent hover:bg-background focus-visible:bg-background focus-visible:border-input"
        />
        {subtask.latest_note_at && !noteOpen && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {format(parseISO(subtask.latest_note_at), "d MMM HH:mm")}
          </span>
        )}
      </div>
    </div>
  );
};
