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
          
          // Show notification for high priority tasks
          const newTask = payload.new as any;
          if (newTask.priority === 'critical' || newTask.priority === 'high') {
            toast({
              title: "New Priority Task",
              description: `${newTask.title} has been created and requires attention.`,
              duration: 5000,
            });

            // Create persistent notification
            await createNotification(user.id, {
              title: "New Priority Task",
              message: `${newTask.title} has been created and requires attention.`,
              type: 'task',
              priority: newTask.priority,
              related_id: newTask.id,
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
              description: `${newTask.title} has been marked as completed.`,
              duration: 3000,
            });

            // Create persistent notification
            await createNotification(user.id, {
              title: "Task Completed",
              message: `${newTask.title} has been marked as completed.`,
              type: 'task',
              priority: 'medium',
              related_id: newTask.id,
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
          event: 'INSERT',
          schema: 'public',
          table: 'tours'
        },
        async (payload) => {
          console.log('New tour created:', payload.new);
          
          // Invalidate tours queries
          queryClient.invalidateQueries({ queryKey: ['tours'] });
          
          // Show notification
          const newTour = payload.new as any;
          toast({
            title: "New Tour Created",
            description: `${newTour.name} has been created with automated tasks.`,
            duration: 4000,
          });

          // Create persistent notification
          await createNotification(user.id, {
            title: "New Tour Created",
            message: `${newTour.name} has been created with automated tasks.`,
            type: 'tour',
            priority: 'high',
            related_id: newTour.id,
          });
        }
      )
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
            toast({
              title: "Tour Dates Updated",
              description: `${newTour.name} dates have been updated. Tasks will be regenerated.`,
              duration: 4000,
            });

            // Create persistent notification
            await createNotification(user.id, {
              title: "Tour Dates Updated",
              message: `${newTour.name} dates have been updated. Tasks will be regenerated.`,
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

          // Create notification for new booking
          const newBooking = payload.new as any;
          await createNotification(user.id, {
            title: "New Booking Created",
            message: `A new booking has been created${newBooking.group_name ? ` for ${newBooking.group_name}` : ''}.`,
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

          // Check for status changes or other important updates
          const oldBooking = payload.old as any;
          const newBooking = payload.new as any;
          
          if (oldBooking.status !== newBooking.status) {
            await createNotification(user.id, {
              title: "Booking Status Changed",
              message: `Booking status changed from ${oldBooking.status} to ${newBooking.status}${newBooking.group_name ? ` for ${newBooking.group_name}` : ''}.`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
            });
          }

          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            await createNotification(user.id, {
              title: "Booking Passenger Count Updated",
              message: `Passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}${newBooking.group_name ? ` for ${newBooking.group_name}` : ''}.`,
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
          await createNotification(user.id, {
            title: "Booking Deleted",
            message: `Booking${deletedBooking.group_name ? ` for ${deletedBooking.group_name}` : ''} has been deleted.`,
            type: 'booking',
            priority: 'medium',
          });
        }
      )
      .subscribe();

    // Listen for hotel booking changes
    const hotelBookingsChannel = supabase
      .channel('hotel-bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hotel_bookings'
        },
        async (payload) => {
          console.log('Hotel booking change:', payload);
          
          // Invalidate hotel bookings queries
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          if (payload.eventType === 'INSERT') {
            const newHotelBooking = payload.new as any;
            await createNotification(user.id, {
              title: "New Hotel Night Added",
              message: `A new hotel night has been added to a booking.`,
              type: 'booking',
              priority: 'medium',
              related_id: newHotelBooking.booking_id,
            });
          }
        }
      )
      .subscribe();

    // Listen for hotel changes
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
          await createNotification(user.id, {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" has been deleted.`,
            type: 'system',
            priority: 'medium',
          });
        }
      )
      .subscribe();

    // Listen for activity changes
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
          await createNotification(user.id, {
            title: "New Activity Added",
            message: `${newActivity.name} has been added to a tour.`,
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
          await createNotification(user.id, {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" has been deleted.`,
            type: 'tour',
            priority: 'medium',
            related_id: deletedActivity.tour_id,
          });
        }
      )
      .subscribe();

    // Listen for customer changes (for dietary requirements)
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
              message: `Dietary requirements for ${newCustomer.first_name} ${newCustomer.last_name} have been updated.`,
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
            message: `Contact ${deletedCustomer.first_name} ${deletedCustomer.last_name} has been deleted.`,
            type: 'system',
            priority: 'medium',
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
