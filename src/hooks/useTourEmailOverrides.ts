import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourEmailRuleOverride {
  id: string;
  tour_id: string;
  rule_id: string;
  email_template_id: string;
  created_at: string;
  updated_at: string;
}

export const useTourEmailOverrides = (tourId: string) => {
  return useQuery({
    queryKey: ['tour-email-overrides', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_email_rule_overrides' as any)
        .select('*')
        .eq('tour_id', tourId);

      if (error) throw error;
      return data as unknown as TourEmailRuleOverride[];
    },
    enabled: !!tourId,
  });
};

export const useUpsertTourEmailOverride = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tourId, ruleId, emailTemplateId }: { tourId: string; ruleId: string; emailTemplateId: string }) => {
      // Try to find existing override
      const { data: existing } = await supabase
        .from('tour_email_rule_overrides' as any)
        .select('id')
        .eq('tour_id', tourId)
        .eq('rule_id', ruleId)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('tour_email_rule_overrides' as any)
          .update({ email_template_id: emailTemplateId } as any)
          .eq('id', (existing as any).id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('tour_email_rule_overrides' as any)
          .insert({ tour_id: tourId, rule_id: ruleId, email_template_id: emailTemplateId } as any)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      // Propagate to pending queue items that don't have a queue-level override
      await Promise.all([
        supabase
          .from('automated_email_log')
          .update({ email_template_id: emailTemplateId })
          .eq('tour_id', tourId)
          .eq('rule_id', ruleId)
          .eq('approval_status', 'pending_approval'),
        supabase
          .from('status_change_email_queue')
          .update({ email_template_id: emailTemplateId })
          .eq('tour_id', tourId)
          .eq('rule_id', ruleId)
          .eq('approval_status', 'pending'),
      ]);

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-email-overrides', variables.tourId] });
      toast({
        title: "Template assigned",
        description: "Tour-specific email template has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template override.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTourEmailOverride = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tourId, ruleId }: { tourId: string; ruleId: string }) => {
      const { error } = await supabase
        .from('tour_email_rule_overrides' as any)
        .delete()
        .eq('tour_id', tourId)
        .eq('rule_id', ruleId);

      if (error) throw error;

      // Clear tour-level template from pending queue items so they fall back to global default
      await Promise.all([
        supabase
          .from('automated_email_log')
          .update({ email_template_id: null })
          .eq('tour_id', tourId)
          .eq('rule_id', ruleId)
          .eq('approval_status', 'pending_approval'),
        supabase
          .from('status_change_email_queue')
          .update({ email_template_id: null })
          .eq('tour_id', tourId)
          .eq('rule_id', ruleId)
          .eq('approval_status', 'pending'),
      ]);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tour-email-overrides', variables.tourId] });
      toast({
        title: "Override removed",
        description: "This rule will now use the global default template.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove override.",
        variant: "destructive",
      });
    },
  });
};
