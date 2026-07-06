import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CancellationPolicy,
  DEFAULT_CANCELLATION_POLICY,
  normaliseCancellationPolicy,
} from "@/lib/cancellationPolicy";

export interface TourCancellationPolicyState {
  enabled: boolean;
  /** raw per-tour override, null when the tour uses the global policy */
  override: CancellationPolicy | null;
  /** the global default policy */
  global: CancellationPolicy;
  /** the policy that will actually render (override ?? global) */
  effective: CancellationPolicy;
}

export const useTourCancellationPolicy = (tourId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["tour-cancellation-policy", tourId],
    enabled: !!tourId,
    queryFn: async (): Promise<TourCancellationPolicyState> => {
      const [{ data: tour, error: tourError }, { data: setting }] = await Promise.all([
        supabase
          .from("tours")
          .select("cancellation_policy_override, cancellation_policy_enabled")
          .eq("id", tourId)
          .single(),
        supabase
          .from("general_settings")
          .select("setting_value")
          .eq("setting_key", "cancellation_policy")
          .maybeSingle(),
      ]);
      if (tourError) throw tourError;

      const global = setting?.setting_value
        ? normaliseCancellationPolicy(setting.setting_value)
        : DEFAULT_CANCELLATION_POLICY;
      const override = tour?.cancellation_policy_override
        ? normaliseCancellationPolicy(tour.cancellation_policy_override)
        : null;
      const enabled = tour?.cancellation_policy_enabled ?? true;

      return { enabled, override, global, effective: override ?? global };
    },
  });

  const update = useMutation({
    mutationFn: async (updates: {
      enabled?: boolean;
      override?: CancellationPolicy | null;
    }) => {
      const payload: Record<string, unknown> = {};
      if (updates.enabled !== undefined) payload.cancellation_policy_enabled = updates.enabled;
      if (updates.override !== undefined)
        payload.cancellation_policy_override = updates.override as unknown as never;
      const { error } = await supabase.from("tours").update(payload as any).eq("id", tourId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-cancellation-policy", tourId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { ...query, update };
};