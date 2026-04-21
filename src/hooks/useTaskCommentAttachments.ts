import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskCommentAttachment {
  id: string;
  comment_id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export const useTaskCommentAttachments = (taskId: string) => {
  return useQuery({
    queryKey: ['task-comment-attachments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comment_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TaskCommentAttachment[];
    },
    enabled: !!taskId,
  });
};

export const useUploadCommentAttachments = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, taskId, files }: { commentId: string; taskId: string; files: File[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const records: any[] = [];
      for (const file of files) {
        const filePath = `tasks/${taskId}/comments/${commentId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(filePath, file);
        if (upErr) throw upErr;
        records.push({
          comment_id: commentId,
          task_id: taskId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: userData.user.id,
        });
      }
      if (records.length > 0) {
        const { error } = await supabase.from('task_comment_attachments').insert(records);
        if (error) throw error;
      }
      return records.length;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-comment-attachments', vars.taskId] });
    },
    onError: (error: any) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteCommentAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (attachment: TaskCommentAttachment) => {
      await supabase.storage.from('attachments').remove([attachment.file_path]);
      const { error } = await supabase
        .from('task_comment_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;
      return attachment;
    },
    onSuccess: (att) => {
      queryClient.invalidateQueries({ queryKey: ['task-comment-attachments', att.task_id] });
      toast({ title: 'Attachment removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
};
