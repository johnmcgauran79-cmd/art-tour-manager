import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const createNotification = async (userId: string, notification: {
  title: string;
  message: string;
  type: 'task' | 'tour' | 'booking' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
}) => {
  const { error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      ...notification,
    });

  if (error) {
    console.error('Error creating notification:', error);
  }
};

export const useRealtimeTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up real-time task subscriptions...');

    const tasksChannel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('New task created:', payload.new);
          
          // Invalidate tasks queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          // Show notification for high priority tasks only (avoid duplicates from manual creation)
          const newTask = payload.new as any;
          if ((newTask.priority === 'critical' || newTask.priority === 'high') && newTask.is_automated) {
            toast({
              title: "New Priority Task",
              description: `${newTask.title} requires attention.`,
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('Task updated:', payload.new);
          
          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          
          // Show notification for status changes
          const oldTask = payload.old as any;
          const newTask = payload.new as any;
          
          if (oldTask.status !== newTask.status && newTask.status === 'completed') {
            toast({
              title: "Task Completed",
              description: `${newTask.title} completed.`,
              duration: 3000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          console.log('Task deleted:', payload.old);
          
          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

          // Create notification for task deletion
          const deletedTask = payload.old as any;
          await createNotification(user.id, {
            title: "Task Deleted",
            message: `Task "${deletedTask.title}" has been deleted.`,
            type: 'task',
            priority: 'medium',
            related_id: deletedTask.id,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignments'
        },
        async (payload) => {
          console.log('New task assignment:', payload.new);
          
          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

          // Create notification for assigned user
          const assignment = payload.new as any;
          if (assignment.user_id === user.id) {
            await createNotification(user.id, {
              title: "Task Assigned",
              message: "You have been assigned a new task.",
              type: 'task',
              priority: 'medium',
              related_id: assignment.task_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments'
        },
        (payload) => {
          console.log('New task comment:', payload.new);
          
          // Invalidate tasks queries to refresh comments
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    const toursChannel = supabase
      .channel('tours-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('Tour updated:', payload.new);
          
          // Invalidate tours queries
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          
          // Check if dates changed and show notification
          const oldTour = payload.old as any;
          const newTour = payload.new as any;
          
          if (oldTour.start_date !== newTour.start_date) {
            await createNotification(user.id, {
              title: "Tour Dates Updated",
              message: `${newTour.name} dates changed - tasks regenerated`,
              type: 'tour',
              priority: 'high',
              related_id: newTour.id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('Tour deleted:', payload.old);
          
          // Invalidate tours queries
          queryClient.invalidateQueries({ queryKey: ['tours'] });

          // Create notification for tour deletion
          const deletedTour = payload.old as any;
          await createNotification(user.id, {
            title: "Tour Deleted",
            message: `Tour "${deletedTour.name}" has been deleted.`,
            type: 'tour',
            priority: 'high',
            related_id: deletedTour.id,
          });
        }
      )
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('New booking created:', payload.new);
          
          // Invalidate bookings queries
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          // Get tour name for better context
          const newBooking = payload.new as any;
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', newBooking.tour_id)
            .single();

          // Create notification for new booking
          await createNotification(user.id, {
            title: "New Booking",
            message: `${newBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newBooking.id,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('Booking updated:', payload.new);
          
          // Invalidate bookings queries
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;
          
          // Get tour name for context
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', newBooking.tour_id)
            .single();

          // Check for status changes
          if (oldBooking.status !== newBooking.status) {
            await createNotification(user.id, {
              title: "Booking Status Changed",
              message: `${newBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}" now ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for passenger count changes
          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            await createNotification(user.id, {
              title: "Booking Updated",
              message: `${newBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}" passenger count: ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for check-in date changes
          if (oldBooking.check_in_date !== newBooking.check_in_date) {
            const checkInDate = newBooking.check_in_date ? new Date(newBooking.check_in_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Check-In Date Changed",
              message: `${newBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}" check-in: ${checkInDate}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for check-out date changes
          if (oldBooking.check_out_date !== newBooking.check_out_date) {
            const checkOutDate = newBooking.check_out_date ? new Date(newBooking.check_out_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Check-Out Date Changed",
              message: `${newBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}" check-out: ${checkOutDate}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('Booking deleted:', payload.old);
          
          // Invalidate bookings queries
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          // Create notification for booking deletion
          const deletedBooking = payload.old as any;
          
          // Get tour name for context
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', deletedBooking.tour_id)
            .single();

          await createNotification(user.id, {
            title: "Booking Deleted",
            message: `${deletedBooking.group_name || 'Booking'} for "${tour?.name || 'Unknown Tour'}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: deletedBooking.id,
          });
        }
      )
      .subscribe();

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
          
          // Invalidate hotel bookings queries
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const newHotelBooking = payload.new as any;
          
          // Get booking and tour context
          const { data: booking } = await supabase
            .from('bookings')
            .select('group_name, tours(name)')
            .eq('id', newHotelBooking.booking_id)
            .single();

          await createNotification(user.id, {
            title: "Hotel Night Added",
            message: `Hotel night added for ${booking?.group_name || 'booking'} on "${booking?.tours?.name || 'Unknown Tour'}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newHotelBooking.booking_id,
          });
        }
      )
      .subscribe();

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
          
          // Invalidate hotels queries
          queryClient.invalidateQueries({ queryKey: ['hotels'] });

          // Create notification for hotel deletion
          const deletedHotel = payload.old as any;
          
          // Get tour name for context
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', deletedHotel.tour_id)
            .single();

          await createNotification(user.id, {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" from "${tour?.name || 'Unknown Tour'}" has been deleted`,
            type: 'system',
            priority: 'medium',
            related_id: deletedHotel.tour_id,
          });
        }
      )
      .subscribe();

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
          
          // Invalidate activities queries
          queryClient.invalidateQueries({ queryKey: ['activities'] });

          const newActivity = payload.new as any;
          
          // Get tour name for context
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', newActivity.tour_id)
            .single();

          await createNotification(user.id, {
            title: "New Activity Added",
            message: `${newActivity.name} added to "${tour?.name || 'Unknown Tour'}"`,
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
          
          // Invalidate activities queries
          queryClient.invalidateQueries({ queryKey: ['activities'] });

          // Create notification for activity deletion
          const deletedActivity = payload.old as any;
          
          // Get tour name for context
          const { data: tour } = await supabase
            .from('tours')
            .select('name')
            .eq('id', deletedActivity.tour_id)
            .single();

          await createNotification(user.id, {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" from "${tour?.name || 'Unknown Tour'}" has been deleted`,
            type: 'tour',
            priority: 'medium',
            related_id: deletedActivity.tour_id,
          });
        }
      )
      .subscribe();

    const customersChannel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers'
        },
        async (payload) => {
          console.log('Customer updated:', payload.new);
          
          // Invalidate customers queries
          queryClient.invalidateQueries({ queryKey: ['customers'] });

          // Check if dietary requirements changed
          const oldCustomer = payload.old as any;
          const newCustomer = payload.new as any;
          
          if (oldCustomer.dietary_requirements !== newCustomer.dietary_requirements) {
            await createNotification(user.id, {
              title: "Dietary Requirements Updated",
              message: `Dietary requirements for ${newCustomer.first_name} ${newCustomer.last_name} have been updated`,
              type: 'system',
              priority: 'medium',
              related_id: newCustomer.id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'customers'
        },
        async (payload) => {
          console.log('Customer deleted:', payload.old);
          
          // Invalidate customers queries
          queryClient.invalidateQueries({ queryKey: ['customers'] });

          // Create notification for customer deletion
          const deletedCustomer = payload.old as any;
          await createNotification(user.id, {
            title: "Contact Deleted",
            message: `Contact ${deletedCustomer.first_name} ${deletedCustomer.last_name} has been deleted`,
            type: 'system',
            priority: 'medium',
            related_id: deletedCustomer.id,
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(toursChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(hotelBookingsChannel);
      supabase.removeChannel(hotelsChannel);
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [queryClient, toast, user?.id]);
};
