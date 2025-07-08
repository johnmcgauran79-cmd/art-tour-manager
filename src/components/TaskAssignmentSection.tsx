
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
  profiles?: User;
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

  // Fetch current task assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['task-assignments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          id,
          user_id,
          task_id,
          assigned_at,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('task_id', taskId);

      if (error) throw error;
      return data as TaskAssignment[];
    },
  });

  // Add assignment mutation
  const addAssignmentMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          user_id: userId,
          assigned_by: user.user.id
        });

      if (error) throw error;
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
    <div className="space-y-3">
      {/* Current Assignments */}
      <div className="flex flex-wrap gap-2">
        {assignments?.map((assignment) => (
          <Badge
            key={assignment.id}
            variant="secondary"
            className="flex items-center gap-1 px-3 py-1"
          >
            {assignment.profiles ? getUserDisplayName(assignment.profiles) : 'Unknown User'}
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

      {/* Add New Assignment */}
      <div className="flex items-center gap-2">
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
