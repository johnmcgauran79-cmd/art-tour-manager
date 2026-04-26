import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HotelExternalLink {
  id: string;
  hotel_id: string;
  label: string;
  url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useHotelExternalLinks = (hotelId: string) => {
  return useQuery({
    queryKey: ['hotel-external-links', hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_external_links')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as HotelExternalLink[];
    },
    enabled: !!hotelId,
  });
};

export const useCreateHotelExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { hotelId: string; label: string; url: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: link, error } = await supabase
        .from('hotel_external_links')
        .insert({
          hotel_id: data.hotelId,
          label: data.label,
          url: data.url,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return link;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-external-links', variables.hotelId] });
      toast({
        title: "External Link Added",
        description: "The external link has been successfully added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateHotelExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; hotelId: string; label: string; url: string }) => {
      const { data: link, error } = await supabase
        .from('hotel_external_links')
        .update({ label: data.label, url: data.url })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return link;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-external-links', variables.hotelId] });
      toast({
        title: "External Link Updated",
        description: "The external link has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteHotelExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; hotelId: string }) => {
      const { error } = await supabase
        .from('hotel_external_links')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-external-links', variables.hotelId] });
      toast({
        title: "External Link Deleted",
        description: "The external link has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};