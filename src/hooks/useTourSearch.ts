
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTourSearch = (searchQuery: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['tours', 'search', searchQuery, limit],
    queryFn: async () => {
      let query = supabase
        .from('tours')
        .select('*', { count: 'exact' })
        .order('start_date', { ascending: false });

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim().toLowerCase();
        
        // Search in tour name, location, tour host, and notes
        query = query.or(`
          name.ilike.%${searchTerm}%,
          location.ilike.%${searchTerm}%,
          tour_host.ilike.%${searchTerm}%,
          notes.ilike.%${searchTerm}%,
          pickup_point.ilike.%${searchTerm}%
        `);
      }

      // Limit results for performance
      query = query.limit(limit);

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: true,
    staleTime: 30000,
  });
};
