import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ActivityAttachment {
  id: string;
  activity_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const useActivityAttachments = (activityId: string) => {
  return useQuery({
    queryKey: ['activity-attachments', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_attachments')
        .select('*')
        .eq('activity_id', activityId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as ActivityAttachment[];
    },
    enabled: !!activityId,
  });
};

export const useUploadActivityAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { activityId: string; file: File }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const fileName = `${Date.now()}-${data.file.name}`;
      const filePath = `activities/${data.activityId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { data: attachment, error: dbError } = await supabase
        .from('activity_attachments')
        .insert({
          activity_id: data.activityId,
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
      queryClient.invalidateQueries({ queryKey: ['activity-attachments', variables.activityId] });
      toast({
        title: "File Uploaded",
        description: "The file has been successfully attached to the activity.",
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

export const useDeleteActivityAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { attachment: ActivityAttachment; activityId: string }) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([data.attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('activity_attachments')
        .delete()
        .eq('id', data.attachment.id);

      if (dbError) throw dbError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity-attachments', variables.activityId] });
      toast({
        title: "File Deleted",
        description: "The attachment has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: `Failed to delete the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });
};
