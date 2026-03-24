import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourAdditionalInfoSection {
  id: string;
  tour_id: string;
  template_id: string | null;
  name: string;
  icon_name: string;
  content: string | null;
  sort_order: number;
  is_visible: boolean;
  include_in_email_rules: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useTourAdditionalInfo = (tourId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['tour-additional-info', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_additional_info_sections')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as TourAdditionalInfoSection[];
    },
    enabled: !!tourId,
  });

  const addSection = useMutation({
    mutationFn: async (section: {
      name: string;
      icon_name: string;
      content?: string;
      template_id?: string;
      sort_order?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tour_additional_info_sections')
        .insert({
          ...section,
          tour_id: tourId,
          created_by: user.id,
          sort_order: section.sort_order ?? sections.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-additional-info', tourId] });
      toast({ title: "Section added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourAdditionalInfoSection> & { id: string }) => {
      const { data, error } = await supabase
        .from('tour_additional_info_sections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-additional-info', tourId] });
      toast({ title: "Section updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tour_additional_info_sections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-additional-info', tourId] });
      toast({ title: "Section deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { sections, isLoading, addSection, updateSection, deleteSection };
};
