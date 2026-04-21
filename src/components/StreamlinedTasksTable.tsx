import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, MapPin } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { TaskCard } from "@/components/cards/TaskCard";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
import { TaskAssigneeAvatars } from "@/components/tasks/TaskAssigneeAvatars";
import { TaskLatestCell } from "@/components/tasks/TaskLatestCell";
import { getTaskStatusColor, formatStatusText } from "@/lib/statusColors";
import { cn } from "@/lib/utils";

interface StreamlinedTasksTableProps {
  tasks: Task[];
  loading?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
  selectedTasks?: string[];
  onTaskSelection?: (taskId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  title?: string;
}

const PRIORITY_DOT: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-priority-critical", label: "Critical" },
  high: { color: "bg-priority-high", label: "High" },
  medium: { color: "bg-priority-medium", label: "Medium" },
  low: { color: "bg-priority-low", label: "Low" },
};

export const StreamlinedTasksTable = ({
  tasks,
  loading = false,
  onCreateTask,
  onTaskClick,
  selectedTasks = [],
  onTaskSelection,
  onSelectAll,
}: StreamlinedTasksTableProps) => {
  const updateTask = useUpdateTask();
  const { hasEditAccess, isViewOnly } = usePermissions();
  const canEditInline = hasEditAccess && !isViewOnly;

  const allSelected = tasks.length > 0 && selectedTasks.length === tasks.length;
  const someSelected = selectedTasks.length > 0 && selectedTasks.length < tasks.length;

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No tasks found</p>
        {onCreateTask && hasEditAccess && (
          <PermissionButton resource="task" action="create" onClick={onCreateTask} className="mt-2">
            Create your first task
          </PermissionButton>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onView={onTaskClick} showTourName />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border bg-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {onTaskSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected || someSelected}
                    onCheckedChange={(c) => onSelectAll?.(!!c)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead className="min-w-[280px]">Task</TableHead>
              <TableHead className="w-[110px]">Users</TableHead>
              <TableHead className="w-[140px]">Tour</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[70px] text-center">Priority</TableHead>
              <TableHead className="w-[110px]">Due Date</TableHead>
              <TableHead className="w-[120px]">Last Update</TableHead>
              <TableHead className="min-w-[200px]">Latest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isOverdue =
                task.due_date &&
                new Date(task.due_date) < new Date() &&
                task.status !== "completed";
              const isSelected = selectedTasks.includes(task.id);
              const priority = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium;
              const lastActivity = new Date(task.last_activity_at || task.updated_at);

              return (
                <TableRow
                  key={task.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/40",
                    isSelected && "bg-accent/60",
                    task.status === "completed" && "opacity-60",
                  )}
                  onClick={() => onTaskClick?.(task)}
                >
                  {onTaskSelection && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => onTaskSelection(task.id, !!c)}
                      />
                    </TableCell>
                  )}

                  {/* Task */}
                  <TableCell className="min-w-[280px]">
                    <div className="font-medium text-sm leading-tight" title={task.title}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div
                        className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
                        title={task.description}
                      >
                        {task.description}
                      </div>
                    )}
                  </TableCell>

                  {/* Users */}
                  <TableCell className="w-[110px]" onClick={(e) => e.stopPropagation()}>
                    <TaskAssigneeAvatars assignees={task.task_assignments || []} max={3} />
                  </TableCell>

                  {/* Tour */}
                  <TableCell className="w-[140px] max-w-[140px]">
                    {task.tours ? (
                      <div className="flex items-center gap-1 text-sm overflow-hidden">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate" title={task.tours.name}>
                          {task.tours.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="w-[130px]" onClick={(e) => e.stopPropagation()}>
                    {canEditInline ? (
                      <Select
                        value={task.status}
                        onValueChange={(value) =>
                          updateTask.mutate({
                            taskId: task.id,
                            updates: { status: value as any },
                            silent: true,
                          })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-7 text-xs px-2 border-0 font-medium justify-center",
                            getTaskStatusColor(task.status),
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="waiting">Waiting</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={cn(
                          "inline-block px-2 py-1 rounded text-xs font-medium",
                          getTaskStatusColor(task.status),
                        )}
                      >
                        {formatStatusText(task.status)}
                      </span>
                    )}
                  </TableCell>

                  {/* Priority — dot only */}
                  <TableCell className="w-[70px] text-center" onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-block h-3 w-3 rounded-full ring-2 ring-background",
                              priority.color,
                            )}
                            aria-label={`Priority: ${priority.label}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{priority.label} priority</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className="w-[110px]">
                    {task.due_date ? (
                      <div
                        className={cn(
                          "text-xs",
                          isOverdue ? "text-error font-medium" : "text-foreground",
                        )}
                      >
                        {format(new Date(task.due_date), "dd MMM yyyy")}
                        {isOverdue && (
                          <div className="text-[10px] text-error font-semibold uppercase tracking-wide">
                            Overdue
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Last Update */}
                  <TableCell className="w-[120px]">
                    <span
                      className="text-xs text-muted-foreground"
                      title={format(lastActivity, "dd/MM/yyyy HH:mm")}
                    >
                      {formatDistanceToNow(lastActivity, { addSuffix: true })}
                    </span>
                  </TableCell>

                  {/* Latest (inline-editable quick_update) */}
                  <TableCell className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <TaskLatestCell
                      taskId={task.id}
                      value={task.quick_update}
                      canEdit={canEditInline}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
