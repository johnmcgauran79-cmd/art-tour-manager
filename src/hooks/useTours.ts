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
  minimum_passengers_required: number | null;
  tour_host: string;
  url_reference: string | null;
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
          capacity: tourData.capacity,
          minimum_passengers_required: tourData.minimum_passengers_required
        }
      });
      
      // Note: Realtime notifications will handle notifying all users
      // No need to create notification here to avoid duplicates
      
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

export const useUpdateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async (data: { tourId: string; updates: Partial<Tour> }) => {
      console.log('Updating tour with data:', data);
      
      // Get original tour data for comparison
      const { data: originalTour } = await supabase
        .from('tours')
        .select('name, capacity, minimum_passengers_required')
        .eq('id', data.tourId)
        .single();
      
      console.log('Original tour data:', originalTour);
      console.log('Updates being applied:', data.updates);
      
      const { data: updatedTour, error } = await supabase
        .from('tours')
        .update(data.updates)
        .eq('id', data.tourId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating tour:', error);
        throw error;
      }

      // Check if capacity or minimum passengers changed and send notifications
      const capacityChanged = data.updates.capacity !== undefined && 
        originalTour?.capacity !== data.updates.capacity;
      const minPassengersChanged = data.updates.minimum_passengers_required !== undefined && 
        originalTour?.minimum_passengers_required !== data.updates.minimum_passengers_required;

      console.log('Capacity changed:', capacityChanged);
      console.log('Min passengers changed:', minPassengersChanged);

      if (capacityChanged || minPassengersChanged) {
        console.log('Changes detected, fetching department users...');
        
        // Send notifications to operations and booking department staff
        const { data: departmentUsers, error: deptError } = await supabase
          .from('user_departments')
          .select('user_id')
          .in('department', ['operations', 'booking']);

        console.log('Department users found:', departmentUsers);
        console.log('Department query error:', deptError);

        if (departmentUsers && departmentUsers.length > 0) {
          const notifications = departmentUsers.map(user => ({
            user_id: user.user_id,
            title: 'Tour Capacity/Minimum Updated',
            message: `Tour "${originalTour?.name || 'Unknown'}" capacity or minimum passengers has been updated. Please review tour requirements.`,
            type: 'tour' as const,
            priority: 'medium' as const,
            related_id: data.tourId,
          }));

          console.log('Creating notifications:', notifications);

          const { error: notifError } = await supabase
            .from('user_notifications')
            .insert(notifications);

          console.log('Notification creation error:', notifError);
          
          if (!notifError) {
            console.log('Notifications created successfully');
          }
        } else {
          console.log('No department users found for operations/booking');
        }
      }

      // Log the tour update
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'tours',
        record_id: data.tourId,
        details: {
          updated_fields: Object.keys(data.updates),
          capacity_changed: capacityChanged,
          min_passengers_changed: minPassengersChanged,
          ...data.updates,
        },
      });

      return updatedTour;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Updated",
        description: `${data.name} has been successfully updated.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in mutation:', error);
      toast({
        title: "Error Updating Tour",
        description: error.message || "Failed to update tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};
