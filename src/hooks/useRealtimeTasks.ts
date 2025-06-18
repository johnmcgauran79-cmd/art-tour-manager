
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
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(toursChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(hotelBookingsChannel);
      supabase.removeChannel(activitiesChannel);
    };
  }, [queryClient, toast, user?.id]);
};
