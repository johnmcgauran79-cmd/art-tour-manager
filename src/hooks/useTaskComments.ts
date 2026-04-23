
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  parent_comment_id: string | null;
  edited_at?: string | null;
  edited_by?: string | null;
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
    mutationFn: async (data: { task_id: string; comment: string; mentioned_users?: string[]; parent_comment_id?: string | null }) => {
      console.log('Creating comment with data:', data);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      console.log('Current user:', user.user.id);

      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: data.task_id,
          user_id: user.user.id,
          comment: data.comment,
          parent_comment_id: data.parent_comment_id ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        throw error;
      }

      console.log('Comment created successfully:', comment);

      // Build notification recipient list: mentioned users + parent commenter (for replies)
      const recipientSet = new Set<string>(data.mentioned_users || []);
      let parentCommenterId: string | null = null;
      if (data.parent_comment_id) {
        const { data: parentComment } = await supabase
          .from('task_comments')
          .select('user_id')
          .eq('id', data.parent_comment_id)
          .single();
        if (parentComment && parentComment.user_id !== user.user.id) {
          parentCommenterId = parentComment.user_id;
          recipientSet.add(parentComment.user_id);
        }
      }
      // Don't notify the author about their own comment
      recipientSet.delete(user.user.id);
      const recipients = Array.from(recipientSet);

      if (recipients.length > 0) {
        console.log('Creating notifications for recipients:', recipients);

        // Auto-add mentioned users as watchers so they can view the task
        const watcherRows = recipients.map((userId) => ({
          task_id: data.task_id,
          user_id: userId,
          added_by: user.user.id,
        }));
        const { error: watcherError } = await supabase
          .from('task_watchers')
          .upsert(watcherRows, { onConflict: 'task_id,user_id', ignoreDuplicates: true });
        if (watcherError) {
          console.error('Failed to add mentioned users as watchers:', watcherError);
        }

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

        console.log('Task details:', task);
        console.log('Commenter details:', commenter);

        const mentionedSet = new Set(data.mentioned_users || []);
        const notifications = recipients.map(userId => {
          const isReplyToParent = userId === parentCommenterId && !mentionedSet.has(userId);
          return {
            user_id: userId,
            type: 'task',
            title: isReplyToParent ? 'New reply to your comment' : 'You were mentioned in a comment',
            message: isReplyToParent
              ? `${commenterName} replied to your comment on task: ${task?.title || 'Unknown task'}`
              : `${commenterName} mentioned you in a comment on task: ${task?.title || 'Unknown task'}`,
            priority: 'medium',
            related_id: data.task_id,
          };
        });

        console.log('Notifications to create:', notifications);

        const { data: createdNotifications, error: notificationError } = await supabase
          .from('user_notifications')
          .insert(notifications)
          .select();

        if (notificationError) {
          console.error('Error creating notifications:', notificationError);
        } else {
          console.log('Notifications created successfully:', createdNotifications);
        }

        // Fire-and-forget notification (don't block UI on Teams/email delivery)
        supabase.functions
          .invoke('send-task-notification', {
            body: {
              type: data.parent_comment_id ? 'reply' : 'mention',
              taskId: data.task_id,
              recipientUserIds: recipients,
              actorUserId: user.user.id,
              message: data.comment,
            },
          })
          .catch((emailErr) => {
            console.error('Failed to send mention notification:', emailErr);
          });
      } else {
        console.log('No recipients to notify');
      }

      return comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.task_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Comment Added",
        description: "Your comment has been added to the task.",
      });
    },
    onError: (error) => {
      console.error('Full error in comment creation:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });
};
