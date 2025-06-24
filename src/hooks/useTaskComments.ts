
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export const useTaskComments = (taskId: string) => {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      // First get the comments
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Then get profile data for each comment
      const commentsWithProfiles = await Promise.all(
        (comments || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', comment.user_id)
            .single();

          return {
            ...comment,
            profiles: profile
          };
        })
      );

      return commentsWithProfiles as TaskComment[];
    },
    enabled: !!taskId,
  });
};

export const useCreateTaskComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { task_id: string; comment: string; mentioned_users?: string[] }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: data.task_id,
          user_id: user.user.id,
          comment: data.comment,
        })
        .select()
        .single();

      if (error) throw error;

      // Create notifications for mentioned users
      if (data.mentioned_users && data.mentioned_users.length > 0) {
        const { data: task } = await supabase
          .from('tasks')
          .select('title')
          .eq('id', data.task_id)
          .single();

        const { data: commenter } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', user.user.id)
          .single();

        const commenterName = commenter 
          ? `${commenter.first_name || ''} ${commenter.last_name || ''}`.trim() || commenter.email
          : 'Someone';

        const notifications = data.mentioned_users.map(userId => ({
          user_id: userId,
          type: 'task',
          title: 'You were mentioned in a comment',
          message: `${commenterName} mentioned you in a comment on task: ${task?.title || 'Unknown task'}`,
          priority: 'medium',
          related_id: data.task_id,
        }));

        const { error: notificationError } = await supabase
          .from('user_notifications')
          .insert(notifications);

        if (notificationError) {
          console.error('Error creating notifications:', notificationError);
        }
      }

      return comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.task_id] });
      toast({
        title: "Comment Added",
        description: "Your comment has been added to the task.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });
};
