
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const useTaskAttachments = (taskId: string) => {
  return useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as TaskAttachment[];
    },
    enabled: !!taskId,
  });
};

export const useUploadTaskAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { taskId: string; file: File }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const fileName = `${Date.now()}-${data.file.name}`;
      const filePath = `tasks/${data.taskId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { data: attachment, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: data.taskId,
          file_name: data.file.name,
          file_path: filePath,
          file_size: data.file.size,
          file_type: data.file.type,
          uploaded_by: user.user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return attachment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.taskId] });
      toast({
        title: "File Uploaded",
        description: "The file has been successfully attached to the task.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    },
  });
};
