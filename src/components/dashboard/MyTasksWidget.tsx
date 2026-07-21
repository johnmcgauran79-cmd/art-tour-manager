import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListTodo, ArrowRight } from "lucide-react";
import { useMyTasks } from "@/hooks/useTasks";
import { isTaskFinished, formatTaskStatus } from "@/lib/taskStatuses";
import { format, parseISO } from "date-fns";

export const MyTasksWidget = () => {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useMyTasks({ assignedToMe: true });

  const openTasks = tasks.filter((t) => !isTaskFinished(t.status));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
        onClick={() => navigate("/?tab=tasks")}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-primary" />
          My Tasks
          {openTasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">{openTasks.length}</Badge>
          )}
          <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && openTasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No open tasks assigned to you 🎉</p>
        )}
        {openTasks.slice(0, 8).map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/tasks/${t.id}`)}
            className="w-full text-left p-2 rounded-md hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatTaskStatus(t.status)}
                  {t.tours?.name && ` · ${t.tours.name}`}
                  {t.due_date && ` · Due ${format(parseISO(t.due_date), "dd/MM/yyyy")}`}
                </p>
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
