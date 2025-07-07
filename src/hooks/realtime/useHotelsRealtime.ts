
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

export const useHotelsRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useHotelsRealtime');
      return;
    }

    console.log('Setting up hotels realtime subscription for user:', userId);

    const channelName = `hotels-realtime-${userId}-${Date.now()}`;
    const hotelsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('New hotel created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const newHotel = payload.new as any;
          
          // New hotels - notify operations department
          await createNotification('', {
            title: "New Hotel Added",
            message: `Hotel "${newHotel.name}" has been added`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'CREATE',
            table_name: 'hotels',
            record_id: newHotel.id,
            details: {
              hotel_name: newHotel.name,
              created_by_realtime: true
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('Hotel updated:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const oldHotel = payload.old as any;
          const newHotel = payload.new as any;
          
          // Hotel changes - notify operations department
          await createNotification('', {
            title: "Hotel Updated",
            message: `Hotel "${newHotel.name}" has been updated`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'UPDATE',
            table_name: 'hotels',
            record_id: newHotel.id,
            details: {
              hotel_name: newHotel.name,
              updated_by_realtime: true
            }
          });

          // Check for capacity issues
          if (newHotel.rooms_booked > newHotel.rooms_reserved) {
            await createNotification('', {
              title: "Hotel Overbooking Alert",
              message: `Hotel "${newHotel.name}" is overbooked: ${newHotel.rooms_booked} booked vs ${newHotel.rooms_reserved} reserved`,
              type: 'system',
              priority: 'high',
              related_id: newHotel.id,
              department: 'operations',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'hotels'
        },
        async (payload) => {
          console.log('Hotel deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const deletedHotel = payload.old as any;
          
          await createNotification('', {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" has been deleted`,
            type: 'system',
            priority: 'medium',
            related_id: deletedHotel.id,
            department: 'operations',
          });

          logOperation({
            operation_type: 'DELETE',
            table_name: 'hotels',
            record_id: deletedHotel.id,
            details: {
              hotel_name: deletedHotel.name,
              deleted_by_realtime: true
            }
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up hotels real-time subscriptions...');
      supabase.removeChannel(hotelsChannel);
    };
  }, [queryClient, userId, logOperation]);
};
