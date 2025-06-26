
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createNotification, getBookingDetails, getTourNameById, getHotelNameById, getActivityNameById } from "@/utils/notificationHelpers";

export const useHotelsActivitiesRealtime = (userId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Hotel Bookings Channel
    const hotelBookingsChannel = supabase
      .channel('hotel-bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hotel_bookings'
        },
        async (payload) => {
          console.log('Hotel booking change:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const newHotelBooking = payload.new as any;
          const { contactName, tourName } = await getBookingDetails(newHotelBooking.booking_id);

          await createNotification(userId, {
            title: "Hotel Night Added",
            message: `Hotel night added for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newHotelBooking.booking_id,
          });
        }
      )
      .subscribe();

    // Hotels Channel
    const hotelsChannel = supabase
      .channel('hotels-realtime')
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

          const deletedHotel = payload.old as any;
          const tourName = await getTourNameById(deletedHotel.tour_id);

          await createNotification(userId, {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" from "${tourName}" has been deleted`,
            type: 'system',
            priority: 'medium',
            related_id: deletedHotel.tour_id,
          });
        }
      )
      .subscribe();

    // Activities Channel
    const activitiesChannel = supabase
      .channel('activities-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        async (payload) => {
          console.log('New activity created:', payload.new);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });

          const newActivity = payload.new as any;
          const tourName = await getTourNameById(newActivity.tour_id);

          await createNotification(userId, {
            title: "New Activity Added",
            message: `${newActivity.name} added to "${tourName}"`,
            type: 'tour',
            priority: 'medium',
            related_id: newActivity.tour_id,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activities'
        },
        async (payload) => {
          console.log('Activity deleted:', payload.old);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });

          const deletedActivity = payload.old as any;
          const tourName = await getTourNameById(deletedActivity.tour_id);

          await createNotification(userId, {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" from "${tourName}" has been deleted`,
            type: 'tour',
            priority: 'medium',
            related_id: deletedActivity.tour_id,
          });
        }
      )
      .subscribe();

    // Activity Bookings Channel
    const activityBookingsChannel = supabase
      .channel('activity-bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activity_bookings'
        },
        async (payload) => {
          console.log('Activity booking updated:', payload);
          
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const oldActivityBooking = payload.old as any;
          const newActivityBooking = payload.new as any;
          
          if (oldActivityBooking.passengers_attending !== newActivityBooking.passengers_attending) {
            const { contactName, tourName } = await getBookingDetails(newActivityBooking.booking_id);
            const activityName = await getActivityNameById(newActivityBooking.activity_id);

            await createNotification(userId, {
              title: "Activity Attendance Changed",
              message: `${contactName}'s attendance for "${activityName}" on "${tourName}" changed from ${oldActivityBooking.passengers_attending} to ${newActivityBooking.passengers_attending} passengers`,
              type: 'booking',
              priority: 'medium',
              related_id: newActivityBooking.booking_id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up hotels/activities real-time subscriptions...');
      supabase.removeChannel(hotelBookingsChannel);
      supabase.removeChannel(hotelsChannel);
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(activityBookingsChannel);
    };
  }, [queryClient, userId]);
};
