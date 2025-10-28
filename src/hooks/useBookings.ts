import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";

export interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  secondary_contact_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  revenue: number | null;
  created_at: string;
  updated_at: string;
  
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  id_number: string | null;
  nationality: string | null;
  
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
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      console.log('[useBookings] Starting query...');
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (name),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `)
          .order('created_at', { ascending: false });
        
        console.log('[useBookings] Query result:', { hasData: !!data, dataLength: data?.length, error: error?.message });
        if (error) {
          console.log('[useBookings] Query error details:', error);
          throw error;
        }
        return data;
      } catch (error) {
        console.log('[useBookings] Exception in query:', error);
        throw error;
      }
    },
    enabled: !!user, // Wait for authentication
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
          customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
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
  const { logOperation } = useAuditLog();

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
      check_in_date?: string | null;
      check_out_date?: string | null;
      invoice_notes?: string;
      
      // Emergency contact
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      emergency_contact_relationship?: string;
      
      // Travel documents
      passport_number?: string;
      passport_expiry_date?: string | null;
      passport_country?: string;
      id_number?: string;
      nationality?: string;
      
      // Medical info
      medical_conditions?: string;
      accessibility_needs?: string;
      dietary_restrictions?: string;
    }) => {
      
      // Calculate nights
      const totalNights = calculateNights(bookingData.check_in_date, bookingData.check_out_date);

      // First, create or find the customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', bookingData.lead_passenger_email)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update the existing customer with any new information including dietary requirements
        const [firstName, ...lastNameParts] = bookingData.lead_passenger_name.split(' ');
        const lastName = lastNameParts.join(' ') || '';

        await supabase
          .from('customers')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: bookingData.lead_passenger_phone || null,
            dietary_requirements: bookingData.dietary_restrictions || null, // Store at customer level
          })
          .eq('id', existingCustomer.id);
        
        console.log("Updated customer dietary requirements to:", bookingData.dietary_restrictions);
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
            dietary_requirements: bookingData.dietary_restrictions || null, // Store at customer level
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;

        console.log("Created customer with dietary requirements:", bookingData.dietary_restrictions);

        // Log customer creation
        logOperation({
          operation_type: 'CREATE',
          table_name: 'customers',
          record_id: newCustomer.id,
          details: {
            customer_name: `${firstName} ${lastName}`,
            email: bookingData.lead_passenger_email
          }
        });
      }

      // Create the booking with all fields, ensuring proper null handling for dates
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          tour_id: bookingData.tour_id,
          lead_passenger_id: customerId,
          passenger_count: bookingData.passenger_count,
          passenger_2_name: bookingData.passenger_2_name || null,
          passenger_3_name: bookingData.passenger_3_name || null,
          group_name: bookingData.group_name || null,
          booking_agent: bookingData.booking_agent || null,
          status: bookingData.status as any,
          extra_requests: bookingData.extra_requests || null,
          accommodation_required: bookingData.accommodation_required,
          check_in_date: bookingData.accommodation_required ? (bookingData.check_in_date || null) : null,
          check_out_date: bookingData.accommodation_required ? (bookingData.check_out_date || null) : null,
          total_nights: totalNights,
          invoice_notes: bookingData.invoice_notes || null,
          
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

      if (error) {
        console.error('Booking creation error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      // Log the booking creation
      logOperation({
        operation_type: 'CREATE',
        table_name: 'bookings',
        record_id: data.id,
        details: {
          lead_passenger_name: bookingData.lead_passenger_name,
          passenger_count: bookingData.passenger_count,
          status: bookingData.status,
          tour_id: bookingData.tour_id,
          is_waitlisted: bookingData.status === 'waitlisted'
        }
      });

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      const isWaitlisted = variables.status === 'waitlisted';
      toast({
        title: isWaitlisted ? "Added to Waitlist" : "Booking Created",
        description: isWaitlisted 
          ? "Contact has been successfully added to the waitlist."
          : "Booking has been successfully created.",
      });
    },
    onError: (error: any) => {
      console.error('Create booking mutation error:', error);
      const errorMessage = error?.message || "Failed to create booking. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string }) => {
      
      // Handle accommodation requirement changes
      const finalUpdates = { ...updates };
      
      // If dietary restrictions are being updated, also update the customer record
      if (updates.dietary_restrictions !== undefined) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('lead_passenger_id')
          .eq('id', id)
          .single();
        
        if (booking?.lead_passenger_id) {
          await supabase
            .from('customers')
            .update({ dietary_requirements: updates.dietary_restrictions || null })
            .eq('id', booking.lead_passenger_id);
          
          console.log("Updated customer dietary requirements for booking:", id);
        }
      }
      
      // If accommodation is set to false, clear accommodation dates
      if (updates.accommodation_required === false) {
        finalUpdates.check_in_date = null;
        finalUpdates.check_out_date = null;
        finalUpdates.total_nights = null;
      }
      // Calculate nights if check-in/out dates are being updated and accommodation is required
      else if (updates.check_in_date !== undefined || updates.check_out_date !== undefined) {
        // Get current booking data to ensure we have both dates
        const { data: currentBooking } = await supabase
          .from('bookings')
          .select('check_in_date, check_out_date, accommodation_required')
          .eq('id', id)
          .single();
        
        // Only calculate nights if accommodation is required
        const accommodationRequired = updates.accommodation_required !== undefined ? updates.accommodation_required : currentBooking?.accommodation_required;
        
        if (accommodationRequired) {
          const checkInDate = updates.check_in_date !== undefined ? updates.check_in_date : currentBooking?.check_in_date;
          const checkOutDate = updates.check_out_date !== undefined ? updates.check_out_date : currentBooking?.check_out_date;
          
          finalUpdates.total_nights = calculateNights(checkInDate, checkOutDate);
        } else {
          finalUpdates.check_in_date = null;
          finalUpdates.check_out_date = null;
          finalUpdates.total_nights = null;
        }
      }
      
      const { data, error } = await supabase
        .from('bookings')
        .update(finalUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the booking update
      logOperation({
        operation_type: 'UPDATE',
        table_name: 'bookings',
        record_id: id,
        details: {
          updated_fields: Object.keys(finalUpdates),
          status_change: updates.status ? `to ${updates.status}` : undefined
        }
      });
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
      
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('delete_booking_simple', {
        p_booking_id: bookingId
      });

      if (error) {
        throw new Error(`Failed to delete booking: ${error.message}`);
      }

      return bookingId;
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
        description: "The booking and all associated records have been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking. Please try again.",
        variant: "destructive",
      });
    },
  });
};
