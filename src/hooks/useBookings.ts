
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
  status: 'pending' | 'invoiced' | 'deposited' | 'paid' | 'cancelled';
  extra_requests: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  created_at: string;
  updated_at: string;
}

export const useBookings = () => {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          tours (name),
          customers (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
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
      passenger_count: number;
      passenger_2_name?: string;
      passenger_3_name?: string;
      group_name?: string;
      booking_agent?: string;
      status: string;
      extra_requests?: string;
      accommodation_required: boolean;
    }) => {
      // First, create or find the customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', bookingData.lead_passenger_email)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const [firstName, ...lastNameParts] = bookingData.lead_passenger_name.split(' ');
        const lastName = lastNameParts.join(' ') || '';

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            first_name: firstName,
            last_name: lastName,
            email: bookingData.lead_passenger_email,
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create the booking
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
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
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
