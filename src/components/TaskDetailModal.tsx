import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Clock, User, Calendar, MapPin, AlertTriangle, Link, Trash2, X, Save, UserPlus } from "lucide-react";
import { Task, useUpdateTask, useDeleteTask, useTasks } from "@/hooks/useTasks";
import { useAutoUnblockTasks } from "@/hooks/useTaskDependencies";
import { formatDistanceToNow, format } from "date-fns";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";
import { TaskAttachmentsSection } from "@/components/TaskAttachmentsSection";
import { TaskDependencyChain } from "@/components/TaskDependencyChain";
import { TaskAssignmentSection } from "@/components/TaskAssignmentSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailModal = ({ task, open, onOpenChange }: TaskDetailModalProps) => {
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const autoUnblock = useAutoUnblockTasks();
  const { data: allTasks } = useTasks();

  useEffect(() => {
    if (task) {
      setEditedTask({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        category: task.category,
        due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd\'T\'HH:mm') : ''
      });
    }
  }, [task]);

  if (!task) return null;

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

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isBlocked = task.dependent_task && task.dependent_task.status !== 'completed';

  // Check if any changes have been made
  const hasChanges = () => {
    if (!task) return false;
    
    return (
      editedTask.title !== task.title ||
      editedTask.description !== task.description ||
      editedTask.status !== task.status ||
      editedTask.priority !== task.priority ||
      editedTask.category !== task.category ||
      editedTask.due_date !== (task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd\'T\'HH:mm') : '')
    );
  };

  const handleUpdateTask = async () => {
    try {
      const updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'category' | 'due_date' | 'completed_at'>> = {};
      
      if (editedTask.title !== task.title) updates.title = editedTask.title;
      if (editedTask.description !== task.description) updates.description = editedTask.description;
      if (editedTask.status !== task.status) updates.status = editedTask.status;
      if (editedTask.priority !== task.priority) updates.priority = editedTask.priority;
      if (editedTask.category !== task.category) updates.category = editedTask.category;
      if (editedTask.due_date !== (task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd\'T\'HH:mm') : '')) {
        updates.due_date = editedTask.due_date ? new Date(editedTask.due_date).toISOString() : null;
      }

      if (Object.keys(updates).length > 0) {
        await updateTask.mutateAsync({
          taskId: task.id,
          updates
        });
        
        // If task was completed, check for auto-unblocking
        if (updates.status === 'completed') {
          await autoUnblock.mutateAsync(task.id);
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async () => {
    try {
      console.log('Starting task deletion for task ID:', task.id);
      await deleteTask.mutateAsync(task.id);
      console.log('Task deletion successful, closing modal');
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getDependentTaskInfo = () => {
    if (!task.dependent_task) return null;
    return allTasks?.find(t => t.id === task.depends_on_task_id);
  };

  const dependentTask = getDependentTaskInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Task Details
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={deleteTask.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteTask.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this task? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteTask.isPending}
                    >
                      {deleteTask.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            View and edit task details, assignments, comments, and attachments.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Task Header - Always in Edit Mode */}
            <div className="space-y-3">
              <Input
                value={editedTask.title || ''}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                placeholder="Task title"
                className="text-xl font-semibold"
              />
              <div className="grid grid-cols-3 gap-3">
                <Select
                  value={editedTask.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => 
                    setEditedTask({ ...editedTask, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="critical">Critical Priority</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={editedTask.status}
                  onValueChange={(value: Task['status']) => 
                    setEditedTask({ ...editedTask, status: value })
                  }
                >
                  <SelectTrigger>
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
                
                <Select
                  value={editedTask.category}
                  onValueChange={(value: Task['category']) => 
                    setEditedTask({ ...editedTask, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                {task.is_automated && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                    Automated
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
                {isBlocked && (
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                    <Link className="h-3 w-3 mr-1" />
                    Blocked
                  </Badge>
                )}
              </div>
            </div>

            {/* Task Description - Always in Edit Mode */}
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <Textarea
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                placeholder="Task description"
                rows={4}
              />
            </div>

            {/* Due Date - Always in Edit Mode */}
            <div>
              <h3 className="font-medium mb-2">Due Date</h3>
              <Input
                type="datetime-local"
                value={editedTask.due_date || ''}
                onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
              />
            </div>

            {/* User Assignment Section */}
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Task Assignments
              </h3>
              <TaskAssignmentSection taskId={task.id} />
            </div>

            {/* Update Actions - Always Visible */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleUpdateTask}
                disabled={updateTask.isPending || !hasChanges()}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateTask.isPending ? "Updating..." : "Update Task"}
              </Button>
              {hasChanges() && (
                <div className="text-sm text-muted-foreground flex items-center">
                  Unsaved changes detected
                </div>
              )}
            </div>

            {/* Task Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {task.tours && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Tour:</span>
                  <span>{task.tours.name}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Created:</span>
                <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
              </div>
              
              {task.task_assignments && task.task_assignments.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Assigned to:</span>
                  <span>{task.task_assignments.length} user{task.task_assignments.length > 1 ? 's' : ''}</span>
                </div>
              )}

              {dependentTask && (
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <Link className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Depends on:</span>
                  <span className="flex items-center gap-2">
                    {dependentTask.title}
                    <Badge variant="outline" className={`text-xs ${getStatusColor(dependentTask.status)}`}>
                      {formatStatus(dependentTask.status)}
                    </Badge>
                  </span>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Completed:</span>
                  <span>{formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>

            {/* Blocked Warning */}
            {isBlocked && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <p className="text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  This task is blocked and cannot be started until the dependent task is completed.
                </p>
              </div>
            )}

            {/* Tabs for Comments and Attachments */}
            <Tabs defaultValue="comments" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="space-y-4">
                <TaskCommentsSection taskId={task.id} />
              </TabsContent>
              <TabsContent value="attachments" className="space-y-4">
                <TaskAttachmentsSection taskId={task.id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {allTasks && (
              <TaskDependencyChain 
                task={task} 
                allTasks={allTasks} 
              />
            )}
          </div>
        </div>

        {/* Bottom Close Button */}
        <div className="flex justify-end pt-6 border-t">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
