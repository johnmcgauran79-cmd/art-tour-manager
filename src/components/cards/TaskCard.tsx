import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, MapPin, AlertTriangle, Eye, Link } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getTaskStatusColor, getTaskPriorityColor, formatStatusText } from "@/lib/statusColors";
import { Task } from "@/hooks/useTasks";
import { typography } from "@/lib/typography";

interface TaskCardProps {
  task: Task;
  onView?: (task: Task) => void;
  showTourName?: boolean;
}

export const TaskCard = ({ task, onView, showTourName = false }: TaskCardProps) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isBlocked = task.dependent_task && task.dependent_task.status !== 'completed';

  return (
    <Card className={`group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in ${
      isOverdue ? 'border-error' : ''
    } ${task.status === 'completed' ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`${typography.cardTitle} line-clamp-2 mb-1.5`}>
              {task.title}
            </h3>
            {showTourName && task.tours && (
              <div className={`flex items-center gap-1.5 ${typography.metadata}`}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{task.tours.name}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Badge className={getTaskStatusColor(task.status)}>
              {formatStatusText(task.status)}
            </Badge>
            <Badge variant="outline" className={`border ${getTaskPriorityColor(task.priority)}`}>
              {formatStatusText(task.priority)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Key Info */}
        <div className="space-y-2">
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className={isOverdue ? 'text-error font-medium' : 'text-foreground'}>
                <span className="text-xs text-muted-foreground mr-1">Due:</span>
                {format(new Date(task.due_date), 'MMM dd, yyyy')}
                <span className="text-xs text-muted-foreground ml-1">
                  ({formatDistanceToNow(new Date(task.due_date), { addSuffix: true })})
                </span>
                {isOverdue && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </span>
                )}
              </div>
            </div>
          )}

          {task.task_assignments && task.task_assignments.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground text-xs">Assigned to:</span>
              <span className="font-medium">
                {task.task_assignments.length} user{task.task_assignments.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {task.category && (
            <div className="text-sm">
              <span className="text-xs text-muted-foreground mr-1">Category:</span>
              <span className="font-medium capitalize">{task.category}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {task.is_automated && (
            <Badge variant="outline" className="text-xs bg-status-instalment-paid text-status-instalment-paid-foreground">
              Auto
            </Badge>
          )}
          {isBlocked && (
            <Badge variant="outline" className="text-xs bg-status-waitlisted text-status-waitlisted-foreground">
              <Link className="h-3 w-3 mr-1" />
              Blocked
            </Badge>
          )}
        </div>

        {/* Actions */}
        {onView && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(task);
              }}
              className="w-full hover-scale"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              View Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
