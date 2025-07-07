
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerSearch = (searchQuery: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['customers', 'search', searchQuery, limit],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim().toLowerCase();
        
        // Search in names, email, phone, and notes
        query = query.or(`
          first_name.ilike.%${searchTerm}%,
          last_name.ilike.%${searchTerm}%,
          email.ilike.%${searchTerm}%,
          phone.ilike.%${searchTerm}%,
          spouse_name.ilike.%${searchTerm}%,
          notes.ilike.%${searchTerm}%
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
