import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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

export const useTourAlerts = (tourId: string | undefined, includeResolved: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribingRef = useRef(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["tour-alerts", tourId, includeResolved],
    queryFn: async () => {
      if (!tourId) return [];
      
      let query = supabase
        .from("tour_alerts")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: false });

      // Filter out acknowledged alerts unless includeResolved is true
      if (!includeResolved) {
        query = query.eq("is_acknowledged", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TourAlert[];
    },
    enabled: !!tourId,
  });

  // Real-time subscription for new alerts
  useEffect(() => {
    if (!tourId) return;

    // Prevent duplicate subscriptions
    if (isSubscribingRef.current) {
      return;
    }

    // Cleanup any existing channel first
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    isSubscribingRef.current = true;

    // Create unique channel name to avoid instance reuse
    const channelName = `tour-alerts-${tourId}-${Date.now()}`;
    
    // Create new channel
    const channel = supabase.channel(channelName);
    channelRef.current = channel;
    
    // Set up event listeners
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tour_alerts',
        filter: `tour_id=eq.${tourId}`
      },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ["tour-alerts", tourId] });
      }
    );

    // Subscribe
    channel.subscribe();

    return () => {
      isSubscribingRef.current = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tourId, queryClient]);

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
