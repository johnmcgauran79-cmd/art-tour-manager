import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserEmails = () => {
  return useQuery({
    queryKey: ['user-emails'],
    queryFn: async () => {
      // Fetch in parallel:
      //  - admin/manager user IDs (only these roles can be used as a From address)
      //  - admin-managed extra From addresses
      const [rolesRes, extrasRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'manager']),
        supabase
          .from('additional_from_emails')
          .select('email, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (extrasRes.error) throw extrasRes.error;

      const allowedUserIds = Array.from(
        new Set((rolesRes.data || []).map((r: any) => r.user_id as string))
      );

      const extras = (extrasRes.data || []).map((r: any) => r.email as string);

      let userEmails: string[] = [];
      if (allowedUserIds.length > 0) {
        const profilesRes = await supabase
          .from('profiles')
          .select('email')
          .in('id', allowedUserIds)
          .not('email', 'is', null)
          .order('email');

        if (profilesRes.error) throw profilesRes.error;

        userEmails = Array.from(
          new Set(
            (profilesRes.data || [])
              .map((p: any) => p.email as string)
              .filter((e) => !!e && !extras.includes(e))
          )
        );
      }

      // Admin-managed extras appear first (in their configured sort order),
      // followed by user account emails alphabetically.
      return [...extras, ...userEmails];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};