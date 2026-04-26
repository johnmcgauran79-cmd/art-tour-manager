import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/**
 * Returns the list of users who are eligible to be assigned to / watch / own tasks.
 * Tasks are restricted to Admin and Manager roles only — hosts, agents and
 * booking agents cannot use the task system, so they must not appear in
 * assignee pickers.
 */
export const useAssignableUsers = () => {
  return useQuery({
    queryKey: ["assignable-users"],
    queryFn: async (): Promise<AssignableUser[]> => {
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "manager"]);

      if (rolesError) throw rolesError;

      const userIds = Array.from(
        new Set((roleRows || []).map((r: any) => r.user_id).filter(Boolean))
      );

      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds)
        .order("first_name");

      if (profilesError) throw profilesError;
      return (profiles || []) as AssignableUser[];
    },
    staleTime: 5 * 60 * 1000,
  });
};