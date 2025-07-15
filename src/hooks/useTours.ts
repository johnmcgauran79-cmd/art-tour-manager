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
        .select('*')
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

      // Check for all significant changes that should trigger notifications
      const changesDetected = [];
      
      // Date changes
      if (data.updates.start_date !== undefined && originalTour?.start_date !== data.updates.start_date) {
        changesDetected.push('start date');
      }
      if (data.updates.end_date !== undefined && originalTour?.end_date !== data.updates.end_date) {
        changesDetected.push('end date');
      }
      if (data.updates.instalment_date !== undefined && originalTour?.instalment_date !== data.updates.instalment_date) {
        changesDetected.push('instalment date');
      }
      if (data.updates.final_payment_date !== undefined && originalTour?.final_payment_date !== data.updates.final_payment_date) {
        changesDetected.push('final payment date');
      }
      
      // Pricing changes
      if (data.updates.price_single !== undefined && originalTour?.price_single !== data.updates.price_single) {
        changesDetected.push('single room price');
      }
      if (data.updates.price_double !== undefined && originalTour?.price_double !== data.updates.price_double) {
        changesDetected.push('double room price');
      }
      if (data.updates.price_twin !== undefined && originalTour?.price_twin !== data.updates.price_twin) {
        changesDetected.push('twin room price');
      }
      if (data.updates.deposit_required !== undefined && originalTour?.deposit_required !== data.updates.deposit_required) {
        changesDetected.push('deposit amount');
      }
      if (data.updates.instalment_amount !== undefined && originalTour?.instalment_amount !== data.updates.instalment_amount) {
        changesDetected.push('instalment amount');
      }
      
      // Tour details changes
      if (data.updates.name !== undefined && originalTour?.name !== data.updates.name) {
        changesDetected.push('tour name');
      }
      if (data.updates.location !== undefined && originalTour?.location !== data.updates.location) {
        changesDetected.push('location');
      }
      if (data.updates.pickup_point !== undefined && originalTour?.pickup_point !== data.updates.pickup_point) {
        changesDetected.push('pickup point');
      }
      if (data.updates.tour_host !== undefined && originalTour?.tour_host !== data.updates.tour_host) {
        changesDetected.push('tour host');
      }
      if (data.updates.status !== undefined && originalTour?.status !== data.updates.status) {
        changesDetected.push('tour status');
      }
      
      // Capacity changes (existing logic)
      if (data.updates.capacity !== undefined && originalTour?.capacity !== data.updates.capacity) {
        changesDetected.push('capacity');
      }
      if (data.updates.minimum_passengers_required !== undefined && originalTour?.minimum_passengers_required !== data.updates.minimum_passengers_required) {
        changesDetected.push('minimum passengers');
      }

      console.log('Changes detected:', changesDetected);

      if (changesDetected.length > 0) {
        console.log('Significant changes detected, fetching department users...');
        
        // Send notifications to operations and booking department staff
        const { data: departmentUsers, error: deptError } = await supabase
          .from('user_departments')
          .select(`
            user_id,
            department,
            profiles!inner(email, first_name, last_name)
          `)
          .in('department', ['operations', 'booking']);

        console.log('Department users found:', departmentUsers);
        console.log('Department query error:', deptError);

        if (departmentUsers && departmentUsers.length > 0) {
          // Get unique user IDs to avoid duplicate notifications
          const uniqueUserIds = [...new Set(departmentUsers.map(user => user.user_id))];
          
          // Create a descriptive message based on what changed
          const changesList = changesDetected.slice(0, 3).join(', ') + 
            (changesDetected.length > 3 ? ` and ${changesDetected.length - 3} other fields` : '');
          
          const notifications = uniqueUserIds.map(userId => ({
            user_id: userId,
            title: 'Tour Details Updated',
            message: `Tour "${originalTour?.name || 'Unknown'}" has been updated. Changes: ${changesList}. Please review and update any related operations or bookings.`,
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
          changes_detected: changesDetected,
          significant_changes: changesDetected.length > 0,
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
