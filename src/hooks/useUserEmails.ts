import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserEmails = () => {
  return useQuery({
    queryKey: ['user-emails'],
    queryFn: async () => {
      // Fetch in parallel: user profile emails + admin-managed extras
      const [profilesRes, extrasRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, user_roles!inner(role)')
          .not('email', 'is', null)
          .in('user_roles.role', ['admin', 'manager'])
          .order('email'),
        supabase
          .from('additional_from_emails')
          .select('email, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (extrasRes.error) throw extrasRes.error;

      const extras = (extrasRes.data || []).map((r: any) => r.email as string);
      // Dedupe in case a user has multiple roles (e.g. admin + manager)
      const userEmails = Array.from(
        new Set(
          (profilesRes.data || [])
            .map((p: any) => p.email as string)
            .filter((e) => !!e && !extras.includes(e))
        )
      );

      // Admin-managed extras appear first (in their configured sort order),
      // followed by user account emails alphabetically.
      return [...extras, ...userEmails];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};