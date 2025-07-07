
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useBookingSearch = (searchQuery: string, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['bookings', 'search', searchQuery, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          tours (name),
          customers (id, first_name, last_name, email, phone, dietary_requirements)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim().toLowerCase();
        
        // Search in customer names, tour names, group names, and passenger names
        query = query.or(`
          customers.first_name.ilike.%${searchTerm}%,
          customers.last_name.ilike.%${searchTerm}%,
          passenger_2_name.ilike.%${searchTerm}%,
          passenger_3_name.ilike.%${searchTerm}%,
          group_name.ilike.%${searchTerm}%,
          tours.name.ilike.%${searchTerm}%
        `);
      }

      // Limit results for performance
      query = query.limit(pageSize);

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: true,
    staleTime: 30000,
  });
};
