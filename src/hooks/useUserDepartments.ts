
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type Department = 'operations' | 'finance' | 'marketing' | 'booking' | 'maintenance' | 'general';

export const useUserDepartments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-departments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_departments')
        .select('department')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(item => item.department) as Department[];
    },
    enabled: !!user?.id,
  });
};

export const useUpdateUserDepartments = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (departments: Department[]) => {
      if (!user?.id) throw new Error('User not authenticated');

      // First, delete all existing departments for the user
      const { error: deleteError } = await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Then insert the new departments
      if (departments.length > 0) {
        const { error: insertError } = await supabase
          .from('user_departments')
          .insert(
            departments.map(department => ({
              user_id: user.id,
              department,
            }))
          );

        if (insertError) throw insertError;
      }

      return departments;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-departments'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Departments Updated",
        description: "Your department preferences have been saved.",
      });
    },
    onError: (error) => {
      console.error('Error updating departments:', error);
      toast({
        title: "Error",
        description: "Failed to update departments. Please try again.",
        variant: "destructive",
      });
    },
  });
};
