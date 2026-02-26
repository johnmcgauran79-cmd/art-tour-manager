import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";


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
  instalment_required: boolean;
  instalment_amount: number | null;
  instalment_date: string | null;
  final_payment_date: string | null;
  travel_documents_required: boolean;
  capacity: number | null;
  minimum_passengers_required: number | null;
  tour_host: string;
  url_reference: string | null;
  tour_type: 'domestic' | 'international' | null;
  pickup_location_required: boolean;
  ops_notes: string | null;
  ops_accomm_notes: string | null;
  ops_races_notes: string | null;
  ops_transport_notes: string | null;
  ops_dinner_notes: string | null;
  ops_activities_notes: string | null;
  ops_other_notes: string | null;
  tour_hosts_notes: string | null;
  host_flights_status: string | null;
  outbound_flight_number: string | null;
  outbound_flight_date: string | null;
  return_flight_number: string | null;
  return_flight_date: string | null;
  created_at: string;
  updated_at: string;
}

// Manual notifications removed - now handled by centralized notification system

export const useTours = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['tours'],
    queryFn: async () => {
      console.log('[useTours] Starting query...');
      try {
        const { data, error } = await supabase
          .from('tours')
          .select('*')
          .order('start_date', { ascending: true });

        console.log('[useTours] Query result:', { hasData: !!data, dataLength: data?.length, error: error?.message });
        
        if (error) {
          console.log('[useTours] Query error details:', error);
          throw error;
        }
        return data as Tour[];
      } catch (error) {
        console.log('[useTours] Exception in query:', error);
        throw error;
      }
    },
    enabled: !!user, // Wait for authentication
  });
};

export const useCreateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();
  

  return useMutation({
    mutationFn: async (tourData: Omit<Tour, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tours')
        .insert([tourData])
        .select()
        .single();

      if (error) throw error;

      // Log the tour creation
      logOperation({
        operation_type: 'CREATE',
        table_name: 'tours',
        record_id: data.id,
        details: {
          tour_name: tourData.name,
          start_date: tourData.start_date,
          location: tourData.location,
          capacity: tourData.capacity,
          minimum_passengers_required: tourData.minimum_passengers_required
        }
      });
      
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      
      toast({
        title: "Tour Created",
        description: `${data.name} has been successfully created.`,
      });
      
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Tour",
        description: error.message || "Failed to create tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (data: { tourId: string; updates: Partial<Tour> }) => {
      const { data: updatedTour, error } = await supabase
        .from('tours')
        .update(data.updates)
        .eq('id', data.tourId)
        .select()
        .single();

      if (error) throw error;

      // Log the tour update
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'tours',
        record_id: data.tourId,
        details: {
          updated_fields: Object.keys(data.updates),
          ...data.updates,
        },
      });

      return updatedTour;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      // Only show toast for minor updates that don't trigger department notifications
      const hasSignificantChanges = Object.keys(variables.updates).some(field => 
        ['start_date', 'end_date', 'instalment_date', 'final_payment_date', 
         'price_single', 'price_double', 'price_twin', 'deposit_required', 'instalment_amount',
         'name', 'location', 'pickup_point', 'tour_host', 'status', 'capacity', 'minimum_passengers_required'].includes(field)
      );
      
      if (!hasSignificantChanges) {
        toast({
          title: "Tour Updated",
          description: `${data.name} has been successfully updated.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Tour",
        description: error.message || "Failed to update tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};
