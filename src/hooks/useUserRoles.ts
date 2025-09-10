import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useUserRoles = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["userRoles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data.map(item => item.role);
    },
    enabled: !!user?.id,
  });
};

export const useIsAdminOrManager = () => {
  const { data: roles = [], isLoading } = useUserRoles();
  
  return {
    isAdminOrManager: roles.includes('admin') || roles.includes('manager'),
    isLoading
  };
};