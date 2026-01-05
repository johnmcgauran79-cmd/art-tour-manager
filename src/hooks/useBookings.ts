import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

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
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  revenue: number | null;
  created_at: string;
  updated_at: string;
  
  // Travel documents
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  id_number: string | null;
  nationality: string | null;
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
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
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
          tours (name, start_date),
          customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
};

export const useFilteredBookings = (filterType: 'deposits_owing' | 'payment_due' | null, page: number = 1, pageSize: number = 50) => {
  const { data: settings } = useGeneralSettings();
  
  return useQuery({
    queryKey: ['bookings', 'filtered', filterType, page, pageSize, settings],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      // Get settings or use defaults
      const depositsOwingDays = settings?.find(s => s.setting_key === 'deposits_owing_days')?.setting_value || 14;
      const paymentDueDays = settings?.find(s => s.setting_key === 'payment_due_days')?.setting_value || 80;

      if (filterType === 'deposits_owing') {
        // Bookings with status 'invoiced' created more than X days ago (configurable)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - depositsOwingDays);
        
        const { data, error, count } = await supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .eq('status', 'invoiced')
          .lt('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
        
      } else if (filterType === 'payment_due') {
        // Bookings not fully paid with tours starting in less than X days (configurable)
        // Exclude hosts (don't pay), cancelled, and waitlisted bookings
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + paymentDueDays);
        
        const { data, error, count } = await supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .neq('status', 'fully_paid')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted')
          .lt('tours.start_date', cutoffDate.toISOString())
          .gte('tours.start_date', new Date().toISOString().split('T')[0]) // Tour hasn't started yet
          .order('created_at', { ascending: false })
          .range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
      }

      // Default return empty
      return { data: [], count: 0 };
    },
    enabled: filterType !== null && settings !== undefined,
  });
};

export const useFilterCounts = () => {
  const { data: settings } = useGeneralSettings();
  
  return useQuery({
    queryKey: ['bookings', 'filter-counts', settings],
    queryFn: async () => {
      // Get settings or use defaults
      const depositsOwingDays = settings?.find(s => s.setting_key === 'deposits_owing_days')?.setting_value || 14;
      const paymentDueDays = settings?.find(s => s.setting_key === 'payment_due_days')?.setting_value || 80;

      // Count deposits owing
      const cutoffDateDeposits = new Date();
      cutoffDateDeposits.setDate(cutoffDateDeposits.getDate() - depositsOwingDays);
      
      const { count: depositsOwingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'invoiced')
        .lt('created_at', cutoffDateDeposits.toISOString());

      // Count final payments due
      const cutoffDatePayments = new Date();
      cutoffDatePayments.setDate(cutoffDatePayments.getDate() + paymentDueDays);
      
      const { count: paymentDueCount } = await supabase
        .from('bookings')
        .select('*, tours!inner(start_date)', { count: 'exact', head: true })
        .neq('status', 'fully_paid')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted')
        .lt('tours.start_date', cutoffDatePayments.toISOString())
        .gte('tours.start_date', new Date().toISOString().split('T')[0]);

      return {
        depositsOwing: depositsOwingCount || 0,
        paymentDue: paymentDueCount || 0,
      };
    },
    enabled: settings !== undefined,
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
      
      // Travel documents
      passport_number?: string;
      passport_expiry_date?: string | null;
      passport_country?: string;
      id_number?: string;
      nationality?: string;
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
          
          // Travel documents
          passport_number: bookingData.passport_number || null,
          passport_expiry_date: bookingData.passport_expiry_date || null,
          passport_country: bookingData.passport_country || null,
          id_number: bookingData.id_number || null,
          nationality: bookingData.nationality || null,
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

// Helper function to recalculate booking dates from hotel bookings
const recalculateBookingDates = async (bookingId: string) => {
  const { data: hotelBookings, error } = await supabase
    .from('hotel_bookings')
    .select('check_in_date, check_out_date')
    .eq('booking_id', bookingId)
    .not('check_in_date', 'is', null)
    .not('check_out_date', 'is', null);

  if (error || !hotelBookings || hotelBookings.length === 0) {
    return;
  }

  // Find earliest check-in and latest check-out
  const checkInDates = hotelBookings.map(hb => new Date(hb.check_in_date!));
  const checkOutDates = hotelBookings.map(hb => new Date(hb.check_out_date!));
  
  const earliestCheckIn = new Date(Math.min(...checkInDates.map(d => d.getTime())));
  const latestCheckOut = new Date(Math.max(...checkOutDates.map(d => d.getTime())));
  
  // Calculate total nights
  const totalNights = Math.ceil((latestCheckOut.getTime() - earliestCheckIn.getTime()) / (1000 * 60 * 60 * 24));

  // Update the booking
  await supabase
    .from('bookings')
    .update({
      check_in_date: earliestCheckIn.toISOString().split('T')[0],
      check_out_date: latestCheckOut.toISOString().split('T')[0],
      total_nights: totalNights
    })
    .eq('id', bookingId);
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logOperation } = useAuditLog();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string }) => {
      
      // Handle accommodation requirement changes
      const finalUpdates = { ...updates };
      
      // If dietary requirements are being updated at customer level, sync to customer record
      // Note: We no longer sync booking.dietary_restrictions - all dietary info is at customer level
      
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

      // Recalculate dates from hotel bookings if they exist
      // This ensures hotel bookings are the source of truth for dates
      await recalculateBookingDates(id);

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
