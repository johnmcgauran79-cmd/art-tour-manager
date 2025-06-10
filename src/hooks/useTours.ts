
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
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

export const useTours = () => {
  return useQuery({
    queryKey: ['tours'],
    queryFn: async () => {
      console.log('Fetching tours...');
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching tours:', error);
        throw error;
      }
      console.log('Tours fetched successfully:', data);
      return data as Tour[];
    },
  });
};

export const useCreateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tourData: Omit<Tour, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating tour with data:', tourData);
      
      const { data, error } = await supabase
        .from('tours')
        .insert([tourData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating tour:', error);
        throw error;
      }
      
      console.log('Tour created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Created",
        description: `${data.name} has been successfully created.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in mutation:', error);
      toast({
        title: "Error Creating Tour",
        description: error.message || "Failed to create tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};
