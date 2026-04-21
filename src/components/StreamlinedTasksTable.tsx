import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Edit, Eye, Trash2, MapPin, Calendar, ClipboardList } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { format, formatDistanceToNow } from "date-fns";
import { TaskCard } from "@/components/cards/TaskCard";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
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

export const StreamlinedTasksTable = ({ 
  tasks, 
  loading = false, 
  onCreateTask, 
  onTaskClick,
  selectedTasks = [],
  onTaskSelection,
  onSelectAll,
  title = "Tasks" 
}: StreamlinedTasksTableProps) => {
  const updateTask = useUpdateTask();
  const { hasEditAccess, isViewOnly } = usePermissions();

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
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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
      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onView={onTaskClick}
            showTourName={true}
          />
        ))}
      </div>
      
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="table-fixed w-full">
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
              <TableHead className="w-[260px]">Name</TableHead>
              <TableHead className="w-[130px]">Associated Tour</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px]">Priority</TableHead>
              <TableHead className="w-[100px]">Due Date</TableHead>
              <TableHead className="w-[110px]">Last Activity</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
              const isSelected = selectedTasks.includes(task.id);

              return (
                <TableRow 
                  key={task.id} 
                  className={`cursor-pointer hover:bg-accent/50 ${
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
                  
                  <TableCell className="w-[260px] max-w-[260px]">
                    <div className="font-medium text-sm truncate" title={task.title}>
                      {task.title}
                    </div>
                    {task.quick_update ? (
                      <div className="text-xs text-muted-foreground truncate mt-1 italic" title={task.quick_update}>
                        💬 {task.quick_update}
                      </div>
                    ) : task.description && (
                      <div className="text-xs text-muted-foreground truncate mt-1" title={task.description}>
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[130px] max-w-[130px]">
                    {task.tours ? (
                      <div className="flex items-center gap-1 text-sm overflow-hidden">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate" title={task.tours.name}>
                          {task.tours.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[120px] max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                    {hasEditAccess && !isViewOnly ? (
                      <Select
                        value={task.status}
                        onValueChange={(value) => updateTask.mutate({ taskId: task.id, updates: { status: value as any } })}
                      >
                        <SelectTrigger className={`h-7 text-xs px-2 ${getStatusColor(task.status)}`}>
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
                      <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                        {formatStatus(task.status)}
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[80px] max-w-[80px]" onClick={(e) => e.stopPropagation()}>
                    {hasEditAccess && !isViewOnly ? (
                      <Select
                        value={task.priority}
                        onValueChange={(value) => updateTask.mutate({ taskId: task.id, updates: { priority: value as any } })}
                      >
                        <SelectTrigger className={`h-7 text-xs px-2 ${getPriorityColor(task.priority)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[100px] max-w-[100px]">
                    {task.due_date ? (
                      <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), 'dd/MM/yyyy')}
                        </div>
                        {isOverdue && (
                          <div className="text-xs text-red-600 font-medium">
                            Overdue
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="w-[110px] max-w-[110px]">
                    <span className="text-xs text-muted-foreground" title={format(new Date(task.last_activity_at || task.updated_at), 'dd/MM/yyyy HH:mm')}>
                      {formatDistanceToNow(new Date(task.last_activity_at || task.updated_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  
                  <TableCell className="w-[100px] max-w-[100px]">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {task.status !== 'completed' && hasEditAccess && (
                        <PermissionButton
                          resource="task"
                          action="edit"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkComplete({ stopPropagation: () => {} } as React.MouseEvent, task.id)}
                          className="h-7 w-7 p-0"
                          actionDescription="mark tasks as complete"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </PermissionButton>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(task);
                        }}
                        className="h-7 w-7 p-0"
                        title="View task"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
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