import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";

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
  instalment_amount: number | null;
  instalment_date: string | null;
  final_payment_date: string | null;
  capacity: number | null;
  tour_host: string;
  created_at: string;
  updated_at: string;
}

const createNotification = async (userId: string, notification: {
  title: string;
  message: string;
  type: 'task' | 'tour' | 'booking' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
}) => {
  const { error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      ...notification,
    });

  if (error) {
    console.error('Error creating notification:', error);
  }
};

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
  const { user } = useAuth();
  const { logOperation } = useAuditLog();

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

      // Log the tour creation
      logOperation({
        operation_type: 'CREATE',
        table_name: 'tours',
        record_id: data.id,
        details: {
          tour_name: tourData.name,
          start_date: tourData.start_date,
          location: tourData.location,
          capacity: tourData.capacity
        }
      });
      
      // Create notification for new tour (not via realtime to avoid duplicates)
      if (user?.id) {
        await createNotification(user.id, {
          title: "Tour Created",
          message: `Tour "${tourData.name}" created successfully`,
          type: 'tour',
          priority: 'medium',
          related_id: data.id,
        });
      }
      
      console.log('Tour created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
