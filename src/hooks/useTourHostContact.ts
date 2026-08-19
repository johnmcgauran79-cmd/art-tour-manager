import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The tour host's contact record — resolved from the booking on the tour that
 * carries the 'host' status. Used to render the {{host_details}} merge field.
 */
export const useTourHostContact = (tourId?: string | null, enabled = true) => {
  return useQuery({
    queryKey: ['tour-host-contact', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('customers:lead_passenger_id (first_name, last_name, phone)')
        .eq('tour_id', tourId as string)
        .eq('status', 'host')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as any)?.customers ?? null;
    },
    enabled: !!tourId && enabled,
    staleTime: 5 * 60 * 1000,
  });
};
