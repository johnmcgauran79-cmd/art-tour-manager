import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, CalendarIcon, Users, ArrowUpRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { TodoDetailDialog } from "@/components/todos/TodoDetailDialog";
import {
  OwnershipFilter,
  OwnershipFilterValue,
  matchesOwnershipFilter,
} from "@/components/workspace/OwnershipFilter";
import {
  usePersonalTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
  useAllTodoShares,
  PersonalTodo,
} from "@/hooks/usePersonalTodos";

const PersonalTodos = () => {
  const { user } = useAuth();
  const { data: todos = [], isLoading } = usePersonalTodos();
  const { data: shares = [] } = useAllTodoShares();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState<Date | undefined>();
  const [showCompleted, setShowCompleted] = useState(true);
  const [selected, setSelected] = useState<PersonalTodo | null>(null);
  const [ownership, setOwnership] = useState<OwnershipFilterValue>("all");

  const selectedLive = selected ? todos.find((t) => t.id === selected.id) ?? selected : null;
  const shareCount = (todoId: string) => shares.filter((s) => s.todo_id === todoId).length;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    createTodo.mutate({ title, due_date: newDue ? format(newDue, "yyyy-MM-dd") : null });
    setNewTitle("");
    setNewDue(undefined);
  };

  const byOwnership = todos.filter((t) =>
    matchesOwnershipFilter(ownership, t.user_id, user?.id, shareCount(t.id))
  );
  const visible = byOwnership.filter((t) => (showCompleted ? true : !t.completed));
  const openCount = todos.filter((t) => !t.completed).length;

  const counts = {
    all: todos.length,
    mine: todos.filter((t) => matchesOwnershipFilter("mine", t.user_id, user?.id, shareCount(t.id))).length,
    shared_by_me: todos.filter((t) =>
      matchesOwnershipFilter("shared_by_me", t.user_id, user?.id, shareCount(t.id))
    ).length,
    shared_with_me: todos.filter((t) =>
      matchesOwnershipFilter("shared_with_me", t.user_id, user?.id, shareCount(t.id))
    ).length,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">My To-Do List</h1>
          <p className="text-sm text-muted-foreground">{openCount} open · private to you</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? "Hide completed" : "Show completed"}
        </Button>
      </div>

      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a quick to-do and press Enter…"
          className="flex-1"
        />
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(!newDue && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{newDue ? format(newDue, "dd/MM/yyyy") : "Due date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={newDue} onSelect={setNewDue} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button onClick={handleAdd} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nothing here yet. Add your first to-do above.</p>
        )}
        {visible.map((todo) => (
          <Card key={todo.id} className="p-3 flex items-center gap-3 group">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={(checked) => updateTodo.mutate({ id: todo.id, completed: !!checked })}
            />
            <button
              onClick={() => setSelected(todo)}
              className="flex-1 text-left min-w-0"
            >
              <span className={cn("text-sm", todo.completed && "line-through text-muted-foreground")}>
                {todo.title}
              </span>
              <span className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                {todo.user_id !== user?.id && <span>Shared with you</span>}
                {todo.notes && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Notes
                  </span>
                )}
                {shareCount(todo.id) > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {shareCount(todo.id)}
                  </span>
                )}
                {todo.converted_task_id && (
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> Task
                  </span>
                )}
              </span>
            </button>
            {todo.due_date && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(parseISO(todo.due_date), "dd/MM/yyyy")}
              </span>
            )}
            {todo.user_id === user?.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this to-do?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{todo.title}" will be permanently removed. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteTodo.mutate(todo.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </Card>
        ))}
      </div>

      <TodoDetailDialog
        todo={selectedLive}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
};

export default PersonalTodos;