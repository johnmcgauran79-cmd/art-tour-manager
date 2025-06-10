
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Tour {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  days: number;
  nights: number;
  location: string | null;
  pickup_point: string | null;
  notes: string | null;
  status: 'pending' | 'available' | 'closed' | 'sold_out' | 'past';
  inclusions: string | null;
  exclusions: string | null;
  price_single: number | null;
  price_double: number | null;
  price_twin: number | null;
  deposit_required: number | null;
  instalment_details: string | null;
  final_payment_date: string | null;
  created_at: string;
  updated_at: string;
}

export const useTours = () => {
  return useQuery({
    queryKey: ['tours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (error) throw error;
      return data as Tour[];
    },
  });
};

export const useCreateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourData: Omit<Tour, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tours')
        .insert([tourData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Created",
        description: "Tour has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create tour. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating tour:', error);
    },
  });
};
