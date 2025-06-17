
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Plus, Filter, Calendar, User, MapPin } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { formatDistanceToNow } from "date-fns";

interface TasksTableProps {
  tasks: Task[];
  loading?: boolean;
  showTourName?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
  title?: string;
}

export const TasksTable = ({ 
  tasks, 
  loading = false, 
  showTourName = false, 
  onCreateTask, 
  onTaskClick,
  title = "Tasks" 
}: TasksTableProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  const updateTask = useUpdateTask();

  // Filter out completed and cancelled tasks by default
  const activeTasks = tasks.filter(task => 
    task.status !== 'completed' && task.status !== 'cancelled'
  );

  const filteredTasks = activeTasks.filter(task => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    return true;
  });

  const taskCounts = {
    total: activeTasks.length,
    pending: activeTasks.filter(t => t.status === 'not_started').length,
    inProgress: activeTasks.filter(t => t.status === 'in_progress').length,
    overdue: activeTasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed'
    ).length,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleCompleteTask = (taskId: string, e: React.MouseEvent | boolean) => {
    if (typeof e !== 'boolean') {
      e.stopPropagation();
    }
    
    updateTask.mutate({
      taskId,
      updates: { status: 'completed' }
    });
  };

  const handleRowClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const isOverdue = (task: Task) => {
    return task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
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
              {taskCounts.total} active tasks
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
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 border border-gray-200 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{taskCounts.pending}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="text-center p-2 border border-blue-200 rounded-lg">
            <div className="text-lg font-semibold text-blue-700">{taskCounts.inProgress}</div>
            <div className="text-xs text-blue-600">In Progress</div>
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
            <p>No active tasks found</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Complete</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                {showTourName && <TableHead>Tour</TableHead>}
                <TableHead>Due Date</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    isOverdue(task) ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                  }`}
                  onClick={() => handleRowClick(task)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={false}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          handleCompleteTask(task.id, true);
                        }
                      }}
                      aria-label="Mark task as complete"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {task.description}
                        </div>
                      )}
                      {task.is_automated && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200 mt-1">
                          Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                      {formatStatus(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">{task.category}</span>
                  </TableCell>
                  {showTourName && (
                    <TableCell>
                      {task.tours ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {task.tours.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {task.due_date ? (
                      <div className={`text-sm ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                        </div>
                        {isOverdue(task) && <span className="text-xs">(Overdue)</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.task_assignments && task.task_assignments.length > 0 ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {task.task_assignments.length} user{task.task_assignments.length > 1 ? 's' : ''}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
