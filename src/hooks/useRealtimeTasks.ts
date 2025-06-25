import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Department } from "@/hooks/useUserDepartments";
import { useAuditLog } from "@/hooks/useAuditLog";

const createNotification = async (userId: string, notification: {
  title: string;
  message: string;
  type: 'task' | 'tour' | 'booking' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
  department?: Department;
}) => {
  const { error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      related_id: notification.related_id,
      department: notification.department,
    });

  if (error) {
    console.error('Error creating notification:', error);
  }
};

const getBookingDetails = async (bookingId: string) => {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        group_name,
        lead_passenger_id,
        tours(name),
        customers(first_name, last_name)
      `)
      .eq('id', bookingId)
      .single();

    if (booking) {
      const contactName = booking.customers 
        ? `${booking.customers.first_name} ${booking.customers.last_name}`
        : booking.group_name || 'Unknown Contact';
      const tourName = booking.tours?.name || 'Unknown Tour';
      
      return { contactName, tourName };
    }
  } catch (error) {
    console.error('Error fetching booking details:', error);
  }
  
  return { contactName: 'Unknown Contact', tourName: 'Unknown Tour' };
};

export const useRealtimeTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { logOperation } = useAuditLog();

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
          
          // Log task creation if it's not from the current user (to avoid duplicate logging)
          const newTask = payload.new as any;
          if (newTask.created_by !== user.id) {
            logOperation({
              operation_type: 'CREATE',
              table_name: 'tasks',
              record_id: newTask.id,
              details: {
                task_title: newTask.title,
                created_by_other_user: true,
                is_automated: newTask.is_automated
              }
            });
          }
          
          // Show notification for high priority tasks only (avoid duplicates from manual creation)
          if ((newTask.priority === 'critical' || newTask.priority === 'high') && newTask.is_automated) {
            toast({
              title: "New Priority Task",
              description: `${newTask.title} requires attention.`,
              duration: 5000,
            });

            // Create department-based notification
            await createNotification(user.id, {
              title: "New Priority Task",
              message: `${newTask.title} requires attention.`,
              type: 'task',
              priority: newTask.priority,
              related_id: newTask.id,
              department: newTask.category as Department,
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
          
          // Log task update if it's not from the current user (to avoid duplicate logging)
          if (oldTask.status !== newTask.status && newTask.updated_at !== oldTask.updated_at) {
            logOperation({
              operation_type: 'UPDATE',
              table_name: 'tasks',
              record_id: newTask.id,
              details: {
                task_title: newTask.title,
                status_change: `from ${oldTask.status} to ${newTask.status}`,
                updated_by_realtime: true
              }
            });
          }
          
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

          // Log task deletion
          const deletedTask = payload.old as any;
          logOperation({
            operation_type: 'DELETE',
            table_name: 'tasks',
            record_id: deletedTask.id,
            details: {
              task_title: deletedTask.title,
              deleted_by_realtime: true
            }
          });

          // Create notification for task deletion
          await createNotification(user.id, {
            title: "Task Deleted",
            message: `Task "${deletedTask.title}" has been deleted.`,
            type: 'task',
            priority: 'medium',
            related_id: deletedTask.id,
            department: deletedTask.category as Department,
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
          
          // Log tour creation
          const newTour = payload.new as any;
          logOperation({
            operation_type: 'CREATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              start_date: newTour.start_date,
              created_by_realtime: true
            }
          });

          await createNotification(user.id, {
            title: "New Tour Created",
            message: `Tour "${newTour.name}" has been created`,
            type: 'tour',
            priority: 'medium',
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
          
          // Log tour update
          logOperation({
            operation_type: 'UPDATE',
            table_name: 'tours',
            record_id: newTour.id,
            details: {
              tour_name: newTour.name,
              date_changed: oldTour.start_date !== newTour.start_date,
              updated_by_realtime: true
            }
          });
          
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

          // Log tour deletion
          const deletedTour = payload.old as any;
          logOperation({
            operation_type: 'DELETE',
            table_name: 'tours',
            record_id: deletedTour.id,
            details: {
              tour_name: deletedTour.name,
              deleted_by_realtime: true
            }
          });

          // Create notification for tour deletion
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

          const newBooking = payload.new as any;
          const { contactName, tourName } = await getBookingDetails(newBooking.id);

          // Log booking creation
          logOperation({
            operation_type: 'CREATE',
            table_name: 'bookings',
            record_id: newBooking.id,
            details: {
              contact_name: contactName,
              tour_name: tourName,
              passenger_count: newBooking.passenger_count,
              created_by_realtime: true
            }
          });

          // Create notification for new booking
          await createNotification(user.id, {
            title: "New Booking",
            message: `New booking for ${contactName} on "${tourName}"`,
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
          
          const { contactName, tourName } = await getBookingDetails(newBooking.id);

          // Check for status changes
          if (oldBooking.status !== newBooking.status) {
            await createNotification(user.id, {
              title: "Booking Status Changed",
              message: `${contactName}'s booking for "${tourName}" changed from ${oldBooking.status} to ${newBooking.status}`,
              type: 'booking',
              priority: newBooking.status === 'cancelled' ? 'high' : 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for passenger count changes
          if (oldBooking.passenger_count !== newBooking.passenger_count) {
            await createNotification(user.id, {
              title: "Passenger Count Updated",
              message: `${contactName}'s booking for "${tourName}" passenger count changed from ${oldBooking.passenger_count} to ${newBooking.passenger_count}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for check-in date changes
          if (oldBooking.check_in_date !== newBooking.check_in_date) {
            const oldDate = oldBooking.check_in_date ? new Date(oldBooking.check_in_date).toLocaleDateString() : 'Not set';
            const newDate = newBooking.check_in_date ? new Date(newBooking.check_in_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Check-In Date Changed",
              message: `${contactName}'s booking for "${tourName}" check-in changed from ${oldDate} to ${newDate}`,
              type: 'booking',
              priority: 'medium',
              related_id: newBooking.id,
            });
          }

          // Check for check-out date changes
          if (oldBooking.check_out_date !== newBooking.check_out_date) {
            const oldDate = oldBooking.check_out_date ? new Date(oldBooking.check_out_date).toLocaleDateString() : 'Not set';
            const newDate = newBooking.check_out_date ? new Date(newBooking.check_out_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Check-Out Date Changed",
              message: `${contactName}'s booking for "${tourName}" check-out changed from ${oldDate} to ${newDate}`,
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

          const deletedBooking = payload.old as any;
          const { contactName, tourName } = await getBookingDetails(deletedBooking.id);

          await createNotification(user.id, {
            title: "Booking Deleted",
            message: `${contactName}'s booking for "${tourName}" has been deleted`,
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
          const { contactName, tourName } = await getBookingDetails(newHotelBooking.booking_id);

          await createNotification(user.id, {
            title: "Hotel Night Added",
            message: `Hotel night added for ${contactName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: newHotelBooking.booking_id,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hotel_bookings'
        },
        async (payload) => {
          console.log('Hotel booking updated:', payload);
          
          // Invalidate hotel bookings queries
          queryClient.invalidateQueries({ queryKey: ['hotels'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const oldHotelBooking = payload.old as any;
          const newHotelBooking = payload.new as any;
          
          const { contactName, tourName } = await getBookingDetails(newHotelBooking.booking_id);

          // Get hotel name for context
          let hotelName = 'hotel';
          try {
            const { data: hotel } = await supabase
              .from('hotels')
              .select('name')
              .eq('id', newHotelBooking.hotel_id)
              .single();

            if (hotel?.name) {
              hotelName = hotel.name;
            }
          } catch (error) {
            console.error('Error fetching hotel name:', error);
          }

          // Check for check-in date changes
          if (oldHotelBooking.check_in_date !== newHotelBooking.check_in_date) {
            const oldDate = oldHotelBooking.check_in_date ? new Date(oldHotelBooking.check_in_date).toLocaleDateString() : 'Not set';
            const newDate = newHotelBooking.check_in_date ? new Date(newHotelBooking.check_in_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Hotel Check-In Date Changed",
              message: `${contactName}'s booking for "${tourName}" at ${hotelName} - Check-in changed from ${oldDate} to ${newDate}`,
              type: 'booking',
              priority: 'medium',
              related_id: newHotelBooking.booking_id,
            });
          }

          // Check for check-out date changes
          if (oldHotelBooking.check_out_date !== newHotelBooking.check_out_date) {
            const oldDate = oldHotelBooking.check_out_date ? new Date(oldHotelBooking.check_out_date).toLocaleDateString() : 'Not set';
            const newDate = newHotelBooking.check_out_date ? new Date(newHotelBooking.check_out_date).toLocaleDateString() : 'Not set';
            await createNotification(user.id, {
              title: "Hotel Check-Out Date Changed",
              message: `${contactName}'s booking for "${tourName}" at ${hotelName} - Check-out changed from ${oldDate} to ${newDate}`,
              type: 'booking',
              priority: 'medium',
              related_id: newHotelBooking.booking_id,
            });
          }
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
          let tourName = 'Unknown Tour';
          try {
            const { data: tour } = await supabase
              .from('tours')
              .select('name')
              .eq('id', deletedHotel.tour_id)
              .single();
            
            if (tour?.name) {
              tourName = tour.name;
            }
          } catch (error) {
            console.error('Error fetching tour name:', error);
          }

          await createNotification(user.id, {
            title: "Hotel Deleted",
            message: `Hotel "${deletedHotel.name}" from "${tourName}" has been deleted`,
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
          let tourName = 'Unknown Tour';
          try {
            const { data: tour } = await supabase
              .from('tours')
              .select('name')
              .eq('id', newActivity.tour_id)
              .single();
            
            if (tour?.name) {
              tourName = tour.name;
            }
          } catch (error) {
            console.error('Error fetching tour name:', error);
          }

          await createNotification(user.id, {
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
          
          // Invalidate activities queries
          queryClient.invalidateQueries({ queryKey: ['activities'] });

          // Create notification for activity deletion
          const deletedActivity = payload.old as any;
          
          // Get tour name for context
          let tourName = 'Unknown Tour';
          try {
            const { data: tour } = await supabase
              .from('tours')
              .select('name')
              .eq('id', deletedActivity.tour_id)
              .single();
            
            if (tour?.name) {
              tourName = tour.name;
            }
          } catch (error) {
            console.error('Error fetching tour name:', error);
          }

          await createNotification(user.id, {
            title: "Activity Deleted",
            message: `Activity "${deletedActivity.name}" from "${tourName}" has been deleted`,
            type: 'tour',
            priority: 'medium',
            related_id: deletedActivity.tour_id,
          });
        }
      )
      .subscribe();

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
          
          // Invalidate activity bookings queries
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['bookings'] });

          const oldActivityBooking = payload.old as any;
          const newActivityBooking = payload.new as any;
          
          // Check if passenger count changed
          if (oldActivityBooking.passengers_attending !== newActivityBooking.passengers_attending) {
            const { contactName, tourName } = await getBookingDetails(newActivityBooking.booking_id);

            // Get activity name for context
            let activityName = 'Unknown Activity';
            try {
              const { data: activity } = await supabase
                .from('activities')
                .select('name')
                .eq('id', newActivityBooking.activity_id)
                .single();

              if (activity?.name) {
                activityName = activity.name;
              }
            } catch (error) {
              console.error('Error fetching activity name:', error);
            }

            await createNotification(user.id, {
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
      supabase.removeChannel(activityBookingsChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [queryClient, toast, user?.id, logOperation]);
};
