
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HotelAttachment {
  id: string;
  hotel_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const useHotelAttachments = (hotelId: string) => {
  return useQuery({
    queryKey: ['hotel-attachments', hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_attachments')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as HotelAttachment[];
    },
    enabled: !!hotelId,
  });
};

export const useUploadHotelAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { hotelId: string; file: File }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const fileName = `${Date.now()}-${data.file.name}`;
      const filePath = `hotels/${data.hotelId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { data: attachment, error: dbError } = await supabase
        .from('hotel_attachments')
        .insert({
          hotel_id: data.hotelId,
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
      queryClient.invalidateQueries({ queryKey: ['hotel-attachments', variables.hotelId] });
      toast({
        title: "File Uploaded",
        description: "The file has been successfully attached to the hotel.",
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
