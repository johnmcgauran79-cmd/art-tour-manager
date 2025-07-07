
import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/hooks/useUserDepartments";

export const createNotification = async (userId: string, notification: {
  title: string;
  message: string;
  type: 'task' | 'tour' | 'booking' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  related_id?: string;
  department?: Department;
}) => {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .insert({
        user_id: userId || null,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        related_id: notification.related_id,
        department: notification.department,
      });

    if (error) {
      console.error('Error creating notification:', error);
    } else {
      console.log('Notification created successfully:', notification.title);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Helper function to get booking details
export const getBookingDetails = async (bookingId: string) => {
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

// Helper function to get task details
export const getTaskDetails = async (taskId: string) => {
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select(`
        title,
        tours(name)
      `)
      .eq('id', taskId)
      .single();

    if (task) {
      const taskName = task.title || 'Unknown Task';
      const tourName = task.tours?.name || null;
      
      return { taskName, tourName };
    }
  } catch (error) {
    console.error('Error fetching task details:', error);
  }
  
  return { taskName: 'Unknown Task', tourName: null };
};

// Helper function to get tour name
export const getTourNameById = async (tourId: string) => {
  try {
    const { data: tour } = await supabase
      .from('tours')
      .select('name')
      .eq('id', tourId)
      .single();
    return tour?.name || 'Unknown Tour';
  } catch (error) {
    console.error('Error fetching tour name:', error);
    return 'Unknown Tour';
  }
};

// Helper function to get hotel name
export const getHotelNameById = async (hotelId: string) => {
  try {
    const { data: hotel } = await supabase
      .from('hotels')
      .select('name')
      .eq('id', hotelId)
      .single();
    return hotel?.name || 'Unknown Hotel';
  } catch (error) {
    console.error('Error fetching hotel name:', error);
    return 'Unknown Hotel';
  }
};

// Helper function to get activity name
export const getActivityNameById = async (activityId: string) => {
  try {
    const { data: activity } = await supabase
      .from('activities')
      .select('name')
      .eq('id', activityId)
      .single();
    return activity?.name || 'Unknown Activity';
  } catch (error) {
    console.error('Error fetching activity name:', error);
    return 'Unknown Activity';
  }
};
