
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskAssignmentSectionProps {
  taskId: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface TaskAssignment {
  id: string;
  user_id: string;
  task_id: string;
  assigned_at: string;
  user?: User;
}

export const TaskAssignmentSection = ({ taskId }: TaskAssignmentSectionProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      return data as User[];
    },
  });

  // Fetch current task assignments with user details
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['task-assignments', taskId],
    queryFn: async () => {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('task_assignments')
        .select('id, user_id, task_id, assigned_at')
        .eq('task_id', taskId);

      if (assignmentError) throw assignmentError;

      // Fetch user details for each assignment
      const assignmentsWithUsers = await Promise.all(
        (assignmentData || []).map(async (assignment) => {
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', assignment.user_id)
            .maybeSingle();

          if (userError) {
            console.error('Error fetching user data:', userError);
            return { ...assignment, user: null };
          }

          return { ...assignment, user: userData as User };
        })
      );

      return assignmentsWithUsers as TaskAssignment[];
    },
  });

  // Add assignment mutation
  const addAssignmentMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // First verify the task exists
      const { data: taskExists, error: taskError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', taskId)
        .maybeSingle();

      if (taskError) {
        console.error('Error checking task existence:', taskError);
        throw new Error(`Failed to verify task exists: ${taskError.message}`);
      }

      if (!taskExists) {
        console.error('Task not found for assignment:', taskId);
        throw new Error('Task not found. Cannot assign user to non-existent task.');
      }

      const { error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          user_id: userId,
          assigned_by: user.user.id
        });

      if (error) throw error;

      // Fire-and-forget notification (don't block UI on Teams/email delivery)
      supabase.functions
        .invoke('send-task-notification', {
          body: {
            type: 'assignment',
            taskId,
            recipientUserIds: [userId],
            actorUserId: user.user.id,
          },
        })
        .catch((emailErr) => {
          console.error('Failed to send assignment notification:', emailErr);
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setSelectedUserId("");
      toast({
        title: "User Assigned",
        description: "User has been successfully assigned to this task.",
      });
    },
    onError: (error) => {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user to task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast({
        title: "Assignment Removed",
        description: "User assignment has been removed from this task.",
      });
    },
    onError: (error) => {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove assignment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddAssignment = () => {
    if (selectedUserId) {
      addAssignmentMutation.mutate(selectedUserId);
    }
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    removeAssignmentMutation.mutate(assignmentId);
  };

  const getUserDisplayName = (user: User) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  };

  const getAvailableUsers = () => {
    if (!users || !assignments) return users || [];
    
    const assignedUserIds = assignments.map(a => a.user_id);
    return users.filter(user => !assignedUserIds.includes(user.id));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading assignments...</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Current Assignments (left-aligned chips) */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {assignments?.map((assignment) => (
          <Badge
            key={assignment.id}
            variant="secondary"
            className="flex items-center gap-1 px-3 py-1"
          >
            {assignment.user ? getUserDisplayName(assignment.user) : 'Unknown User'}
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 hover:bg-red-100"
              onClick={() => handleRemoveAssignment(assignment.id)}
              disabled={removeAssignmentMutation.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {(!assignments || assignments.length === 0) && (
          <span className="text-sm text-muted-foreground">No users assigned</span>
        )}
      </div>

      {/* Add New Assignment (right-aligned on same row) */}
      <div className="flex items-center gap-2 ml-auto">
        <Select
          value={selectedUserId}
          onValueChange={setSelectedUserId}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select user to assign" />
          </SelectTrigger>
          <SelectContent>
            {getAvailableUsers().map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {getUserDisplayName(user)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleAddAssignment}
          disabled={!selectedUserId || addAssignmentMutation.isPending}
          className="flex items-center gap-1"
        >
          <UserPlus className="h-4 w-4" />
          {addAssignmentMutation.isPending ? "Adding..." : "Assign"}
        </Button>
      </div>
    </div>
  );
};
