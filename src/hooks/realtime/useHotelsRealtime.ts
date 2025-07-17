
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { createNotification } from "@/utils/notificationHelpers";

export const useHotelsRealtime = (userId: string) => {
  const queryClient = useQueryClient();
  const { logOperation } = useAuditLog();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) {
      console.log('No userId provided to useHotelsRealtime');
      return;
    }

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('Hotels realtime already subscribed, skipping...');
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
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "New Hotel Added",
            message: `Hotel "${newHotel.name}" has been added by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "New Hotel Added",
            message: `Hotel "${newHotel.name}" has been added by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'booking',
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
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "Hotel Updated",
            message: `Hotel "${newHotel.name}" has been updated by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "Hotel Updated",
            message: `Hotel "${newHotel.name}" has been updated by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: newHotel.id,
            department: 'booking',
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

          // Check for capacity issues - separate notification for overbooking
          if (newHotel.rooms_booked > newHotel.rooms_reserved && 
              oldHotel.rooms_booked <= oldHotel.rooms_reserved) {
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
          
          // Get the current user's profile to include who made the change
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          
          const userName = currentUserProfile 
            ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim()
            : 'Unknown User';
          
          // Notify both operations and booking departments
          await createNotification('', {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" has been deleted by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: deletedHotel.id,
            department: 'operations',
          });
          
          await createNotification('', {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" has been deleted by ${userName}`,
            type: 'system',
            priority: 'medium',
            related_id: deletedHotel.id,
            department: 'booking',
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

    channelRef.current = hotelsChannel;

    return () => {
      console.log('Cleaning up hotels real-time subscriptions...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, userId, logOperation]);
};
