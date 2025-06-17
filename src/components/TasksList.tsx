
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Filter } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { Task } from "@/hooks/useTasks";

interface TasksListProps {
  tasks: Task[];
  loading?: boolean;
  showTourName?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
  title?: string;
}

export const TasksList = ({ 
  tasks, 
  loading = false, 
  showTourName = false, 
  onCreateTask, 
  onTaskClick,
  title = "Tasks" 
}: TasksListProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    return true;
  });

  const taskCounts = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'not_started').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed'
    ).length,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">{title}</CardTitle>
            <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
              {taskCounts.total} tasks
            </Badge>
          </div>
          {onCreateTask && (
            <Button
              onClick={onCreateTask}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          )}
        </div>
        
        {/* Task Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-2 border border-gray-200 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{taskCounts.pending}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="text-center p-2 border border-blue-200 rounded-lg">
            <div className="text-lg font-semibold text-blue-700">{taskCounts.inProgress}</div>
            <div className="text-xs text-blue-600">In Progress</div>
          </div>
          <div className="text-center p-2 border border-green-200 rounded-lg">
            <div className="text-lg font-semibold text-green-700">{taskCounts.completed}</div>
            <div className="text-xs text-green-600">Completed</div>
          </div>
          <div className="text-center p-2 border border-red-200 rounded-lg">
            <div className="text-lg font-semibold text-red-700">{taskCounts.overdue}</div>
            <div className="text-xs text-red-600">Overdue</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Filters:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tasks found</p>
            {onCreateTask && (
              <Button
                onClick={onCreateTask}
                variant="outline"
                className="mt-4"
              >
                Create your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showTourName={showTourName}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
