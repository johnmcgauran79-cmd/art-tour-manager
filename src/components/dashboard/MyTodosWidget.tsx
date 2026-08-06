import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, ArrowRight, Users } from "lucide-react";
import {
  usePersonalTodos,
  useUpdateTodo,
  useAllTodoShares,
  PersonalTodo,
} from "@/hooks/usePersonalTodos";
import { TodoDetailDialog } from "@/components/todos/TodoDetailDialog";
import { format, parseISO } from "date-fns";

export const MyTodosWidget = () => {
  const navigate = useNavigate();
  const { data: todos = [], isLoading } = usePersonalTodos();
  const { data: shares = [] } = useAllTodoShares();
  const updateTodo = useUpdateTodo();
  const [selected, setSelected] = useState<PersonalTodo | null>(null);

  const selectedLive = selected ? todos.find((t) => t.id === selected.id) ?? selected : null;

  const open = todos.filter((t) => !t.completed);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
        onClick={() => navigate("/todos")}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4 text-primary" />
          My To-Do List
          {open.length > 0 && (
            <Badge variant="secondary" className="ml-1">{open.length}</Badge>
          )}
          <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && open.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing on your list 🎉</p>
        )}
        {open.slice(0, 10).map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/60 transition-colors"
          >
            <Checkbox
              checked={t.completed}
              onCheckedChange={(v) => updateTodo.mutate({ id: t.id, completed: !!v })}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
            <button
              onClick={() => setSelected(t)}
              className="flex-1 text-left min-w-0"
            >
              <p className="text-sm truncate">{t.title}</p>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {t.due_date && <span>Due {format(parseISO(t.due_date), "dd/MM/yyyy")}</span>}
                {shares.some((s) => s.todo_id === t.id) && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {shares.filter((s) => s.todo_id === t.id).length}
                  </span>
                )}
              </span>
            </button>
          </div>
        ))}
      </CardContent>

      <TodoDetailDialog
        todo={selectedLive}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </Card>
  );
};
