
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  revenue: number | null;
  created_at: string;
  updated_at: string;
  
  // Emergency contact information
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  
  // Passport/ID details
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  id_number: string | null;
  nationality: string | null;
  
  // Medical and dietary
  medical_conditions: string | null;
  accessibility_needs: string | null;
  dietary_restrictions: string | null;
}

// Helper function to calculate nights
const calculateNights = (checkIn: string | null, checkOut: string | null): number | null => {
  if (!checkIn || !checkOut) return null;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
};

export const useBookings = () => {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours (name),
          customers (id, first_name, last_name, email, phone, dietary_requirements)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const usePaginatedBookings = (page: number = 1, pageSize: number = 25) => {
  return useQuery({
    queryKey: ['bookings', 'paginated', page, pageSize],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      const { data, error, count } = await supabase
        .from('bookings')
        .select(`
          *,
          tours (name),
          customers (id, first_name, last_name, email, phone, dietary_requirements)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingData: {
      tour_id: string;
      lead_passenger_name: string;
      lead_passenger_email: string;
      lead_passenger_phone?: string;
      passenger_count: number;
      passenger_2_name?: string;
      passenger_3_name?: string;
      group_name?: string;
      booking_agent?: string;
      status: string;
      extra_requests?: string;
      accommodation_required: boolean;
      check_in_date?: string;
      check_out_date?: string;
      invoice_notes?: string;
      
      // Emergency contact
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      emergency_contact_relationship?: string;
      
      // Travel documents
      passport_number?: string;
      passport_expiry_date?: string;
      passport_country?: string;
      id_number?: string;
      nationality?: string;
      
      // Medical info
      medical_conditions?: string;
      accessibility_needs?: string;
      dietary_restrictions?: string;
    }) => {
      // Calculate nights
      const totalNights = calculateNights(bookingData.check_in_date || null, bookingData.check_out_date || null);

      // First, create or find the customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', bookingData.lead_passenger_email)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update the existing customer with any new information
        const [firstName, ...lastNameParts] = bookingData.lead_passenger_name.split(' ');
        const lastName = lastNameParts.join(' ') || '';

        await supabase
          .from('customers')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: bookingData.lead_passenger_phone || null,
          })
          .eq('id', existingCustomer.id);
      } else {
        const [firstName, ...lastNameParts] = bookingData.lead_passenger_name.split(' ');
        const lastName = lastNameParts.join(' ') || '';

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            first_name: firstName,
            last_name: lastName,
            email: bookingData.lead_passenger_email,
            phone: bookingData.lead_passenger_phone || null,
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create the booking with all fields except removed payment fields
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          tour_id: bookingData.tour_id,
          lead_passenger_id: customerId,
          passenger_count: bookingData.passenger_count,
          passenger_2_name: bookingData.passenger_2_name,
          passenger_3_name: bookingData.passenger_3_name,
          group_name: bookingData.group_name,
          booking_agent: bookingData.booking_agent,
          status: bookingData.status as any,
          extra_requests: bookingData.extra_requests,
          accommodation_required: bookingData.accommodation_required,
          check_in_date: bookingData.check_in_date,
          check_out_date: bookingData.check_out_date,
          total_nights: totalNights,
          invoice_notes: bookingData.invoice_notes,
          
          // Emergency contact
          emergency_contact_name: bookingData.emergency_contact_name || null,
          emergency_contact_phone: bookingData.emergency_contact_phone || null,
          emergency_contact_relationship: bookingData.emergency_contact_relationship || null,
          
          // Travel documents
          passport_number: bookingData.passport_number || null,
          passport_expiry_date: bookingData.passport_expiry_date || null,
          passport_country: bookingData.passport_country || null,
          id_number: bookingData.id_number || null,
          nationality: bookingData.nationality || null,
          
          // Medical info
          medical_conditions: bookingData.medical_conditions || null,
          accessibility_needs: bookingData.accessibility_needs || null,
          dietary_restrictions: bookingData.dietary_restrictions || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Booking Created",
        description: "Booking has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating booking:', error);
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string }) => {
      console.log('Updating booking with data:', { id, updates });
      
      // Calculate nights if check-in/out dates are being updated
      const finalUpdates = { ...updates };
      if (updates.check_in_date !== undefined || updates.check_out_date !== undefined) {
        // Get current booking data to ensure we have both dates
        const { data: currentBooking } = await supabase
          .from('bookings')
          .select('check_in_date, check_out_date')
          .eq('id', id)
          .single();
        
        const checkInDate = updates.check_in_date !== undefined ? updates.check_in_date : currentBooking?.check_in_date;
        const checkOutDate = updates.check_out_date !== undefined ? updates.check_out_date : currentBooking?.check_out_date;
        
        finalUpdates.total_nights = calculateNights(checkInDate, checkOutDate);
      }
      
      const { data, error } = await supabase
        .from('bookings')
        .update(finalUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating booking:', error);
        throw error;
      }
      console.log('Booking updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      toast({
        title: "Booking Updated",
        description: "Booking has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update booking. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating booking:', error);
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      console.log('Starting batch booking deletion process for:', bookingId);

      try {
        // First, let's check how many related records exist
        const [hotelCount, activityCount] = await Promise.all([
          supabase.from('hotel_bookings').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId),
          supabase.from('activity_bookings').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId)
        ]);

        console.log(`Found ${hotelCount.count || 0} hotel bookings and ${activityCount.count || 0} activity bookings`);

        // If there are too many records, use batch deletion
        if ((hotelCount.count || 0) > 100 || (activityCount.count || 0) > 100) {
          console.log('Large dataset detected, using batch deletion');
          
          // Batch delete hotel bookings
          let deleted = 0;
          while (deleted < (hotelCount.count || 0)) {
            const { error } = await supabase
              .from('hotel_bookings')
              .delete()
              .eq('booking_id', bookingId)
              .limit(50);
            
            if (error) {
              console.error('Error in batch hotel deletion:', error);
              break;
            }
            deleted += 50;
            console.log(`Deleted ${Math.min(deleted, hotelCount.count || 0)} of ${hotelCount.count || 0} hotel bookings`);
          }

          // Batch delete activity bookings
          deleted = 0;
          while (deleted < (activityCount.count || 0)) {
            const { error } = await supabase
              .from('activity_bookings')
              .delete()
              .eq('booking_id', bookingId)
              .limit(50);
            
            if (error) {
              console.error('Error in batch activity deletion:', error);
              break;
            }
            deleted += 50;
            console.log(`Deleted ${Math.min(deleted, activityCount.count || 0)} of ${activityCount.count || 0} activity bookings`);
          }
        } else {
          console.log('Normal dataset size, using standard deletion');
          
          // Try the database function first for normal-sized datasets
          const { error } = await supabase.rpc('delete_booking_with_cascade', {
            p_booking_id: bookingId
          });

          if (error) {
            console.error('Database function failed:', error);
            
            // Fallback to sequential deletion
            const { error: hotelError } = await supabase
              .from('hotel_bookings')
              .delete()
              .eq('booking_id', bookingId);
            
            if (hotelError) {
              console.error('Error deleting hotel bookings:', hotelError);
            }

            const { error: activityError } = await supabase
              .from('activity_bookings')
              .delete()
              .eq('booking_id', bookingId);
            
            if (activityError) {
              console.error('Error deleting activity bookings:', activityError);
            }
          } else {
            console.log('Database function succeeded, skipping manual deletion');
            return bookingId; // Early return if DB function worked
          }
        }

        // Finally, delete the booking itself
        const { error: bookingError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);

        if (bookingError) {
          console.error('Error deleting main booking:', bookingError);
          throw new Error(`Failed to delete booking: ${bookingError.message}`);
        }

        console.log('Booking and all associated records deleted successfully');
        return bookingId;
      } catch (error: any) {
        console.error('Error in deletion process:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      
      toast({
        title: "Booking Deleted",
        description: "The booking and all associated allocations have been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      console.error('Error deleting booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking. There may be too much related data. Please contact support.",
        variant: "destructive",
      });
    },
  });
};
