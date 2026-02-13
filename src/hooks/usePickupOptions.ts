import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PickupOption {
  id: string;
  tour_id: string;
  name: string;
  pickup_time: string | null;
  details: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const usePickupOptions = (tourId: string) => {
  return useQuery({
    queryKey: ['pickup_options', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_pickup_options')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as PickupOption[];
    },
    enabled: !!tourId,
  });
};

export const useCreatePickupOption = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { tour_id: string; name: string; pickup_time?: string; details?: string; sort_order: number }) => {
      const { data: result, error } = await supabase
        .from('tour_pickup_options')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pickup_options', variables.tour_id] });
      toast({ title: "Pickup option added" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdatePickupOption = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, tourId, updates }: { id: string; tourId: string; updates: Partial<PickupOption> }) => {
      const { data, error } = await supabase
        .from('tour_pickup_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pickup_options', variables.tourId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeletePickupOption = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, tourId }: { id: string; tourId: string }) => {
      const { error } = await supabase
        .from('tour_pickup_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pickup_options', variables.tourId] });
      toast({ title: "Pickup option removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
