import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  operation_type: string;
  timestamp: string;
  details: any;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export const useBookingAuditLog = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ['booking-audit-log', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, user_id, operation_type, timestamp, details')
        .eq('table_name', 'bookings')
        .eq('record_id', bookingId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching audit log:', error);
        throw error;
      }

      // Fetch user profiles separately
      const userIds = [...new Set(data?.map(entry => entry.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      // Merge profiles with audit entries
      const entriesWithProfiles = data?.map(entry => ({
        ...entry,
        profiles: profiles?.find(p => p.id === entry.user_id) || null
      })) || [];

      return entriesWithProfiles as AuditLogEntry[];
    },
    enabled: !!bookingId,
  });
};
