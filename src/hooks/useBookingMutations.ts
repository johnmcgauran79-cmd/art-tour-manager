import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Booking } from "./useBookingQueries";

// Helper function to calculate nights
const calculateNights = (checkIn: string | null, checkOut: string | null): number | null => {
  if (!checkIn || !checkOut) return null;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
};

// Helper function to recalculate booking dates from hotel bookings
const recalculateBookingDates = async (bookingId: string) => {
  const { data: hotelBookings, error } = await supabase
    .from('hotel_bookings')
    .select('check_in_date, check_out_date')
    .eq('booking_id', bookingId)
    .not('check_in_date', 'is', null)
    .not('check_out_date', 'is', null);

  let checkInDate: string;
  let checkOutDate: string;
  let totalNights: number;

  if (error || !hotelBookings || hotelBookings.length === 0) {
    // No hotel bookings - fallback to tour dates
    const { data: booking } = await supabase
      .from('bookings')
      .select('tour_id, accommodation_required')
      .eq('id', bookingId)
      .single();
    
    if (!booking?.tour_id || !booking?.accommodation_required) {
      return;
    }
    
    const { data: tour } = await supabase
      .from('tours')
      .select('start_date, end_date, nights')
      .eq('id', booking.tour_id)
      .single();
    
    if (!tour) {
      return;
    }
    
    checkInDate = tour.start_date;
    checkOutDate = tour.end_date;
    totalNights = tour.nights;
  } else {
    // Find earliest check-in and latest check-out from hotel bookings
    const checkInDates = hotelBookings.map(hb => new Date(hb.check_in_date!));
    const checkOutDates = hotelBookings.map(hb => new Date(hb.check_out_date!));
    
    const earliestCheckIn = new Date(Math.min(...checkInDates.map(d => d.getTime())));
    const latestCheckOut = new Date(Math.max(...checkOutDates.map(d => d.getTime())));
    
    checkInDate = earliestCheckIn.toISOString().split('T')[0];
    checkOutDate = latestCheckOut.toISOString().split('T')[0];
    totalNights = Math.ceil((latestCheckOut.getTime() - earliestCheckIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Update the booking
  await supabase
    .from('bookings')
    .update({
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      total_nights: totalNights
    })
    .eq('id', bookingId);
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
      passenger_2_id?: string | null;
      passenger_3_id?: string | null;
      group_name?: string;
      booking_agent?: string;
      status: string;
      extra_requests?: string;
      accommodation_required: boolean;
      check_in_date?: string | null;
      check_out_date?: string | null;
      invoice_notes?: string;
      invoice_reference?: string;
      passport_number?: string;
      passport_expiry_date?: string | null;
      passport_country?: string;
      nationality?: string;
      whatsapp_group_comms?: boolean;
      secondary_contact_id?: string | null;
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

      // Create the booking with all fields
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          tour_id: bookingData.tour_id,
          lead_passenger_id: customerId,
          passenger_count: bookingData.passenger_count,
          passenger_2_name: bookingData.passenger_2_name || null,
          passenger_3_name: bookingData.passenger_3_name || null,
          passenger_2_id: bookingData.passenger_2_id || null,
          passenger_3_id: bookingData.passenger_3_id || null,
          secondary_contact_id: bookingData.secondary_contact_id || null,
          group_name: bookingData.group_name || null,
          booking_agent: bookingData.booking_agent || null,
          status: bookingData.status as any,
          extra_requests: bookingData.extra_requests || null,
          accommodation_required: bookingData.accommodation_required,
          check_in_date: bookingData.accommodation_required ? (bookingData.check_in_date || null) : null,
          check_out_date: bookingData.accommodation_required ? (bookingData.check_out_date || null) : null,
          total_nights: totalNights,
          invoice_notes: bookingData.invoice_notes || null,
          invoice_reference: bookingData.invoice_reference || null,
          passport_number: bookingData.passport_number || null,
          passport_expiry_date: bookingData.passport_expiry_date || null,
          passport_country: bookingData.passport_country || null,
          nationality: bookingData.nationality || null,
          whatsapp_group_comms: bookingData.whatsapp_group_comms ?? true,
        }])
        .select()
        .single();

      if (error) {
        console.error('Booking creation error:', error);
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
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string; passenger_2_id?: string | null; passenger_3_id?: string | null; invoice_reference?: string | null }) => {
      const finalUpdates: Record<string, any> = { ...updates };

      // Normalize empty date strings
      if (finalUpdates.check_in_date === '') finalUpdates.check_in_date = null;
      if (finalUpdates.check_out_date === '') finalUpdates.check_out_date = null;

      // If accommodation is set to false, clear accommodation dates
      if (updates.accommodation_required === false) {
        finalUpdates.check_in_date = null;
        finalUpdates.check_out_date = null;
        finalUpdates.total_nights = null;
      }
      // Calculate nights if check-in/out dates are being updated
      else if (updates.check_in_date !== undefined || updates.check_out_date !== undefined) {
        const { data: currentBooking } = await supabase
          .from('bookings')
          .select('check_in_date, check_out_date, accommodation_required')
          .eq('id', id)
          .single();

        const accommodationRequired =
          updates.accommodation_required !== undefined
            ? updates.accommodation_required
            : currentBooking?.accommodation_required;

        if (accommodationRequired) {
          const checkInDate =
            updates.check_in_date !== undefined ? (updates.check_in_date || null) : currentBooking?.check_in_date;
          const checkOutDate =
            updates.check_out_date !== undefined ? (updates.check_out_date || null) : currentBooking?.check_out_date;

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

      // Recalculate dates from hotel bookings
      await recalculateBookingDates(id);

      logOperation({
        operation_type: 'UPDATE',
        table_name: 'bookings',
        record_id: id,
        details: {
          updated_fields: Object.keys(finalUpdates),
          status_change: updates.status ? `to ${updates.status}` : undefined,
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings'] });
      toast({
        title: 'Booking Updated',
        description: 'Booking has been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update booking. Please try again.',
        variant: 'destructive',
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
