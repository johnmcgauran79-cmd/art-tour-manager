import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourExternalLink {
  id: string;
  tour_id: string;
  label: string;
  url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useTourExternalLinks = (tourId: string) => {
  return useQuery({
    queryKey: ['tour-external-links', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_external_links')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TourExternalLink[];
    },
    enabled: !!tourId,
  });
};

export const useCreateTourExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { tourId: string; label: string; url: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: link, error } = await supabase
        .from('tour_external_links')
        .insert({
          tour_id: data.tourId,
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
      queryClient.invalidateQueries({ queryKey: ['tour-external-links', variables.tourId] });
      toast({
        title: "External Link Added",
        description: "The external link has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTourExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; tourId: string; label: string; url: string }) => {
      const { data: link, error } = await supabase
        .from('tour_external_links')
        .update({
          label: data.label,
          url: data.url,
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return link;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-external-links', variables.tourId] });
      toast({
        title: "External Link Updated",
        description: "The external link has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTourExternalLink = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; tourId: string }) => {
      const { error } = await supabase
        .from('tour_external_links')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-external-links', variables.tourId] });
      toast({
        title: "External Link Deleted",
        description: "The external link has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete external link. Please try again.",
        variant: "destructive",
      });
    },
  });
};