import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TourAlert } from "./useTourAlerts";

export const useGlobalTourAlerts = (includeResolved: boolean = false) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["global-tour-alerts", includeResolved],
    queryFn: async () => {
      let query = supabase
        .from("tour_alerts")
        .select(`
          *,
          tours!inner(name)
        `)
        .order("created_at", { ascending: false });

      // Filter out acknowledged alerts unless includeResolved is true
      if (!includeResolved) {
        query = query.eq("is_acknowledged", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (TourAlert & { tours: { name: string } })[];
    },
  });

  // Real-time subscription for new alerts across all tours
  useEffect(() => {
    // Cleanup any existing channel first
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create unique channel name
    const channelName = `global-tour-alerts-${Date.now()}`;
    
    // Create new channel
    const channel = supabase.channel(channelName);
    channelRef.current = channel;
    
    // Set up event listeners for all tour alerts
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tour_alerts',
      },
      (payload) => {
        console.log('Global alert change detected:', payload);
        queryClient.invalidateQueries({ queryKey: ["global-tour-alerts"] });
      }
    );

    // Subscribe
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to global tour alerts');
      }
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, includeResolved]);

  const unacknowledgedCount = alerts.filter(a => !a.is_acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged).length;

  return {
    alerts,
    isLoading,
    unacknowledgedCount,
    criticalCount,
  };
};
