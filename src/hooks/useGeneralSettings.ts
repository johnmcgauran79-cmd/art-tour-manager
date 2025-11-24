import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GeneralSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useGeneralSettings = () => {
  return useQuery({
    queryKey: ['general-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      return data as GeneralSetting[];
    },
  });
};

export const useUpdateGeneralSetting = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ settingKey, value }: { settingKey: string; value: any }) => {
      const { data, error } = await supabase
        .from('general_settings')
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq('setting_key', settingKey)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-settings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({
        title: "Settings Updated",
        description: "General settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating general setting:', error);
    },
  });
};
