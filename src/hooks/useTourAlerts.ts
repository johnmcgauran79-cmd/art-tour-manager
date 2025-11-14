import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourAlert {
  id: string;
  tour_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: any;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  booking_id: string | null;
  hotel_id: string | null;
  activity_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useTourAlerts = (tourId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["tour-alerts", tourId],
    queryFn: async () => {
      if (!tourId) return [];
      
      const { data, error } = await supabase
        .from("tour_alerts")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TourAlert[];
    },
    enabled: !!tourId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("tour_alerts")
        .update({
          is_acknowledged: true,
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-alerts", tourId] });
      toast({
        title: "Alert acknowledged",
        description: "The alert has been marked as reviewed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert: " + error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("tour_alerts")
        .delete()
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-alerts", tourId] });
      toast({
        title: "Alert deleted",
        description: "The alert has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete alert: " + error.message,
        variant: "destructive",
      });
    },
  });

  const unacknowledgedCount = alerts.filter(a => !a.is_acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged).length;

  return {
    alerts,
    isLoading,
    unacknowledgedCount,
    criticalCount,
    acknowledgeAlert: acknowledgeMutation.mutate,
    deleteAlert: deleteAlertMutation.mutate,
  };
};
