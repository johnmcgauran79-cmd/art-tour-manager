
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, User, Calendar, MapPin } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { formatDistanceToNow } from "date-fns";
import { stripEntityTokens } from "@/lib/entityLinks";

interface TaskCardProps {
  task: Task;
  showTourName?: boolean;
  onTaskClick?: (task: Task) => void;
}

export const TaskCard = ({ task, showTourName = false, onTaskClick }: TaskCardProps) => {
  const updateTask = useUpdateTask();

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

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (updateTask.isPending) return;
    
    updateTask.mutate({
      taskId: task.id,
      updates: { status: 'completed' }
    });
  };

  const handleCardClick = () => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
        isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
      } ${task.status === 'completed' ? 'opacity-60' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-2">{task.title}</h4>
            
            {/* Task details under title */}
            <div className="space-y-1 mb-3">
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

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                {formatStatus(task.status)}
              </Badge>
              {task.is_automated && (
                <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-200">
                  Auto
                </Badge>
              )}
            </div>
          </div>
          {task.status !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkComplete}
              className="ml-2 flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4" />
              Complete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {task.description && (
          <p className="text-sm text-gray-600">{stripEntityTokens(task.description)}</p>
        )}
      </CardContent>
    </Card>
  );
};
