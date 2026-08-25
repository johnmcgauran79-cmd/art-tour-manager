import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EdmSocial } from "@/lib/edm/blocks";

const SETTING_KEY = "marketing_social_links";

/**
 * Standard social links saved once and reused across every marketing template
 * (footer social icons, social blocks).
 */
export const useSocialLinks = () =>
  useQuery({
    queryKey: ["marketing-social-links"],
    queryFn: async (): Promise<EdmSocial[]> => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error) throw error;
      const value = data?.setting_value;
      return Array.isArray(value) ? (value as EdmSocial[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

export const useSaveSocialLinks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (socials: EdmSocial[]) => {
      const { error } = await supabase
        .from("general_settings")
        .upsert(
          {
            setting_key: SETTING_KEY,
            setting_value: socials as any,
            description: "Default social media links used in marketing emails",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );
      if (error) throw error;
      return socials;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-social-links"] });
      toast({ title: "Saved", description: "These are now your standard social links." });
    },
    onError: (error: any) =>
      toast({
        title: "Couldn't save social links",
        description: error?.message || "Please try again.",
        variant: "destructive",
      }),
  });
};
