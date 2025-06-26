
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, User, MoreHorizontal, Calendar, Flag } from "lucide-react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface QuickTaskActionsProps {
  task: Task;
  onTaskClick?: (task: Task) => void;
}

export const QuickTaskActions = ({ task, onTaskClick }: QuickTaskActionsProps) => {
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const updateTask = useUpdateTask();

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data;
    },
  });

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({
      taskId: task.id,
      updates: { status: 'completed' }
    });
  };

  const handleStatusChange = (status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({
      taskId: task.id,
      updates: { status: status as Task['status'] }
    });
    setStatusPopoverOpen(false);
  };

  const handlePriorityChange = (priority: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({
      taskId: task.id,
      updates: { priority: priority as Task['priority'] }
    });
    setPriorityPopoverOpen(false);
  };

  const handleAssignUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Add task assignment
    const { error } = await supabase
      .from('task_assignments')
      .insert({
        task_id: task.id,
        user_id: userId,
        assigned_by: (await supabase.auth.getUser()).data.user?.id || ''
      });

    if (!error) {
      setAssignPopoverOpen(false);
    }
  };

  const getUserDisplayName = (user: any) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  const isBlocked = task.dependent_task && task.dependent_task.status !== 'completed';

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Quick Complete Button */}
      {task.status !== 'completed' && !isBlocked && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleMarkComplete}
          className="h-8 w-8 p-0 text-green-600 border-green-300 hover:bg-green-50"
          title="Mark as Complete"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      )}

      {/* Quick Status Change */}
      <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            title="Change Status"
          >
            <Calendar className="h-3 w-3 mr-1" />
            {task.status.replace('_', ' ')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          <div className="space-y-1">
            {['not_started', 'in_progress', 'waiting', 'completed', 'cancelled'].map((status) => (
              <Button
                key={status}
                variant={task.status === status ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={(e) => handleStatusChange(status, e)}
              >
                {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Priority Change */}
      <Popover open={priorityPopoverOpen} onOpenChange={setPriorityPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            title="Change Priority"
          >
            <Flag className="h-3 w-3 mr-1" />
            {task.priority}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-2">
          <div className="space-y-1">
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <Button
                key={priority}
                variant={task.priority === priority ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={(e) => handlePriorityChange(priority, e)}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Assign */}
      <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            title="Assign User"
          >
            <User className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Assign to:</div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {users?.map((user) => (
                <Button
                  key={user.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={(e) => handleAssignUser(user.id, e)}
                >
                  {getUserDisplayName(user)}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* More Actions */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(task);
        }}
        title="View Details"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
};
