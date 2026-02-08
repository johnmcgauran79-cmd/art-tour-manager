import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaiverRecord {
  id: string;
  booking_id: string;
  customer_id: string | null;
  passenger_slot: number;
  signed_name: string;
  signed_at: string;
  waiver_version: number;
  ip_address: string | null;
}

export const useWaiverStatus = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ["booking-waivers", bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from("booking_waivers")
        .select("id, booking_id, customer_id, passenger_slot, signed_name, signed_at, waiver_version, ip_address")
        .eq("booking_id", bookingId)
        .order("passenger_slot");

      if (error) throw error;
      return (data || []) as WaiverRecord[];
    },
    enabled: !!bookingId,
  });
};
