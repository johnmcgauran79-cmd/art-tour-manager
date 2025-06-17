
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Clock, User, Calendar, MapPin, AlertTriangle } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { formatDistanceToNow, format } from "date-fns";

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailModal = ({ task, open, onOpenChange }: TaskDetailModalProps) => {
  const [status, setStatus] = useState<Task['status']>('not_started');
  const [notes, setNotes] = useState("");
  
  const updateTask = useUpdateTask();

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setNotes("");
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  const handleUpdateStatus = () => {
    updateTask.mutate({
      taskId: task.id,
      updates: { status }
    });
    onOpenChange(false);
  };

  const handleMarkComplete = () => {
    updateTask.mutate({
      taskId: task.id,
      updates: { status: 'completed' }
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Task Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with badges */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{task.title}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`${getPriorityColor(task.priority)}`}>
                {task.priority} priority
              </Badge>
              <Badge variant="outline" className={`${getStatusColor(task.status)}`}>
                {formatStatus(task.status)}
              </Badge>
              <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                {task.category}
              </Badge>
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
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{task.description}</p>
            </div>
          )}

          {/* Task Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {task.tours && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Tour:</span>
                <span>{task.tours.name}</span>
              </div>
            )}
            
            {task.due_date && (
              <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-600' : ''}`}>
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Due:</span>
                <span>
                  {format(new Date(task.due_date), 'PPP')} 
                  ({formatDistanceToNow(new Date(task.due_date), { addSuffix: true })})
                </span>
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

            {task.completed_at && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Completed:</span>
                <span>{formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}</span>
              </div>
            )}
          </div>

          {/* Status Update */}
          {task.status !== 'completed' && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Update Task Status</h3>
              <div className="flex gap-3">
                <Select value={status} onValueChange={(value: Task['status']) => setStatus(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleUpdateStatus}
                  disabled={status === task.status || updateTask.isPending}
                  variant="outline"
                >
                  {updateTask.isPending ? "Updating..." : "Update Status"}
                </Button>
                
                <Button
                  onClick={handleMarkComplete}
                  disabled={updateTask.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Add Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or comments about this task..."
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!notes.trim()}
            >
              Add Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
