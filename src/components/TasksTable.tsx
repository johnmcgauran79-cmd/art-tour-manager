import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, User, Calendar, MapPin, AlertTriangle, Link, ClipboardList } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { formatDistanceToNow, format } from "date-fns";
import { QuickTaskActions } from "@/components/QuickTaskActions";
import { getTaskStatusColor, getTaskPriorityColor, formatStatusText } from "@/lib/statusColors";

interface TasksTableProps {
  tasks: Task[];
  loading?: boolean;
  showTourName?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
  selectedTasks?: string[];
  onTaskSelection?: (taskId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  title?: string;
}

export const TasksTable = ({ 
  tasks, 
  loading = false, 
  showTourName = false, 
  onCreateTask, 
  onTaskClick,
  selectedTasks = [],
  onTaskSelection,
  onSelectAll,
  title = "Tasks" 
}: TasksTableProps) => {
  const updateTask = useUpdateTask();

  const handleMarkComplete = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    
    if (updateTask.isPending) return;
    
    updateTask.mutate({
      taskId: taskId,
      updates: { status: 'completed' }
    });
  };

  const allSelected = tasks.length > 0 && selectedTasks.length === tasks.length;
  const someSelected = selectedTasks.length > 0 && selectedTasks.length < tasks.length;

  const handleSelectAll = (checked: boolean) => {
    if (onSelectAll) {
      onSelectAll(checked);
    }
  };

  const handleRowClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const handleTaskSelect = (taskId: string, checked: boolean) => {
    if (onTaskSelection) {
      onTaskSelection(taskId, checked);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading tasks...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No tasks found</p>
        {onCreateTask && (
          <Button onClick={onCreateTask} className="mt-2">
            Create your first task
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {onTaskSelection && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected || someSelected}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=checked]:bg-primary"
                  aria-label={allSelected ? "Deselect all" : someSelected ? "Select all" : "Select all"}
                />
              </TableHead>
            )}
            <TableHead>Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Category</TableHead>
            {showTourName && <TableHead>Tour</TableHead>}
            <TableHead>Due Date</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead className="w-48">Quick Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            const isBlocked = task.dependent_task && task.dependent_task.status !== 'completed';
            const isSelected = selectedTasks.includes(task.id);

            return (
              <TableRow 
                key={task.id} 
                className={`cursor-pointer hover:bg-gray-50 ${
                  isOverdue ? 'bg-red-50' : ''
                } ${task.status === 'completed' ? 'opacity-60' : ''} ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleRowClick(task)}
              >
                {onTaskSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleTaskSelect(task.id, !!checked)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div>
                    <div className="font-medium text-sm">{task.title}</div>
                    
                    {/* Task details under title */}
                    <div className="space-y-1 mt-1">
                      {showTourName && task.tours && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {task.tours.name}
                        </div>
                      )}
                      
                      {task.due_date && (
                        <div className={`flex items-center gap-2 text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          <Calendar className="h-3 w-3" />
                          Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                          {isOverdue && <span className="font-semibold">(Overdue)</span>}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                      </div>
                      
                      {task.task_assignments && task.task_assignments.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          Assigned to {task.task_assignments.length} user{task.task_assignments.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {task.description && (
                      <div className="text-xs text-gray-500 mt-2 truncate max-w-xs">
                        {task.description}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      {task.is_automated && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200">
                          Auto
                        </Badge>
                      )}
                      {isBlocked && (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                          <Link className="h-3 w-3 mr-1" />
                          Blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs border ${getTaskStatusColor(task.status)}`}>
                    {formatStatusText(task.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs border ${getTaskPriorityColor(task.priority)}`}>
                    {formatStatusText(task.priority)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm capitalize">{task.category}</span>
                </TableCell>
                {showTourName && (
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      {task.tours ? (
                        <>
                          <MapPin className="h-3 w-3 text-gray-500" />
                          {task.tours.name}
                        </>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  {task.due_date ? (
                    <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-xs">
                        {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                      </div>
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">No due date</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.task_assignments && task.task_assignments.length > 0 ? (
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-gray-500" />
                      {task.task_assignments.length}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <QuickTaskActions task={task} onTaskClick={onTaskClick} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
