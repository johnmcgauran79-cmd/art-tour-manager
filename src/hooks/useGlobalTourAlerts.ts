import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TourAlert } from "./useTourAlerts";

export const useGlobalTourAlerts = (includeResolved: boolean = false) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastInvalidationRef = useRef<number>(0);

  const { data: alerts = [], isLoading, refetch } = useQuery({
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
    // Create unique channel name using timestamp and random value
    const channelName = `global-tour-alerts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new channel
    const channel = supabase.channel(channelName);
    
    // Set up event listeners for all tour alerts
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tour_alerts',
      },
      (payload) => {
        // Debounce invalidations to prevent multiple rapid refetches
        const now = Date.now();
        if (now - lastInvalidationRef.current > 300) {
          lastInvalidationRef.current = now;
          queryClient.invalidateQueries({ queryKey: ["global-tour-alerts"] });
        }
      }
    );

    // Subscribe
    channel.subscribe();

    // Store reference for cleanup
    channelRef.current = channel;

    return () => {
      // Clean up this specific channel using closure
      channel.unsubscribe();
      supabase.removeChannel(channel);
      
      // Clear ref only if it's still pointing to this channel
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, []); // Empty dependencies - only run once on mount

  const unacknowledgedCount = alerts.filter(a => !a.is_acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged).length;

  return {
    alerts,
    isLoading,
    unacknowledgedCount,
    criticalCount,
    refetch,
  };
};
