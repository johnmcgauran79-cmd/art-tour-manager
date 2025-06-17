
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourAttachment {
  id: string;
  tour_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const useTourAttachments = (tourId: string) => {
  return useQuery({
    queryKey: ['tour-attachments', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_attachments')
        .select('*')
        .eq('tour_id', tourId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as TourAttachment[];
    },
    enabled: !!tourId,
  });
};

export const useUploadTourAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { tourId: string; file: File }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const fileName = `${Date.now()}-${data.file.name}`;
      const filePath = `tours/${data.tourId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { data: attachment, error: dbError } = await supabase
        .from('tour_attachments')
        .insert({
          tour_id: data.tourId,
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
      queryClient.invalidateQueries({ queryKey: ['tour-attachments', variables.tourId] });
      toast({
        title: "File Uploaded",
        description: "The file has been successfully attached to the tour.",
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
