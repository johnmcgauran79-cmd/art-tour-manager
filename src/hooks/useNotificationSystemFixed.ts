import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type Department = 'operations' | 'finance' | 'marketing' | 'booking' | 'maintenance' | 'general';

// Centralized notification creation utility
const createNotificationForUsers = async (
  userIds: string[],
  notification: {
    title: string;
    message: string;
    type: string;
    priority: string;
    related_id: string;
  }
) => {
  console.log('📝 Creating notifications for users:', userIds.length, 'notification:', notification.title);
  
  if (userIds.length === 0) {
    console.warn('⚠️ No users to notify');
    return false;
  }

  const notifications = userIds.map(userId => ({
    user_id: userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    priority: notification.priority,
    related_id: notification.related_id,
    department: null
  }));

  const { error } = await supabase
    .from('user_notifications')
    .insert(notifications);

  if (error) {
    console.error('❌ Failed to create notifications:', error);
    return false;
  }

  console.log(`✅ Successfully created ${notifications.length} notifications`);
  return true;
};

// Get unique users from departments (avoid duplicates)
const getUsersFromDepartments = async (departments: Department[]) => {
  console.log('👥 Getting users from departments:', departments);
  
  const uniqueUserIds = new Set<string>();

  for (const department of departments) {
    const { data: users, error } = await supabase
      .from('user_departments')
      .select('user_id')
      .eq('department', department);

    if (error) {
      console.error(`❌ Error fetching users from ${department} department:`, error);
      continue;
    }

    if (users) {
      users.forEach(user => uniqueUserIds.add(user.user_id));
      console.log(`✅ Found ${users.length} users in ${department} department`);
    }
  }

  const userIds = Array.from(uniqueUserIds);
  console.log(`👥 Total unique users found: ${userIds.length}`);
  return userIds;
};

// Get users assigned to a task (avoid duplicates with operations)
const getTaskUsers = async (taskId: string) => {
  console.log('🎯 Getting users for task:', taskId);
  
  const uniqueUserIds = new Set<string>();

  // Get assigned users
  const { data: assignments, error: assignError } = await supabase
    .from('task_assignments')
    .select('user_id')
    .eq('task_id', taskId);

  if (assignError) {
    console.error('❌ Error fetching task assignments:', assignError);
  } else if (assignments) {
    assignments.forEach(assignment => uniqueUserIds.add(assignment.user_id));
    console.log(`✅ Found ${assignments.length} assigned users for task`);
  }

  // Also include operations department users
  const operationsUsers = await getUsersFromDepartments(['operations']);
  operationsUsers.forEach(userId => uniqueUserIds.add(userId));

  const userIds = Array.from(uniqueUserIds);
  console.log(`🎯 Total users for task notifications: ${userIds.length}`);
  return userIds;
};

export const useNotificationSystemFixed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  console.log('🚨 FIXED NOTIFICATION SYSTEM HOOK CALLED - user:', user?.id);
  
  useEffect(() => {
    console.log('🔧 FIXED useNotificationSystem useEffect triggered - user:', user?.id);
    
    if (!user?.id) {
      console.log('❌ No user authenticated, skipping notification system setup');
      return;
    }

    // Force cleanup of any existing subscription first
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }

    console.log('📡 Setting up FIXED real-time subscription...');

    // Create a new channel
    const channel = supabase.channel(`notifications-${Date.now()}`);
    
    // BOOKINGS - Insert, Update, Delete
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, async (payload) => {
      console.log('🆕 FIXED: New booking detected:', payload.new);
      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('*, customers(first_name, last_name), tours(name)')
          .eq('id', payload.new.id)
          .single();

        if (error || !booking) return;

        const customerName = booking.customers ? `${booking.customers.first_name} ${booking.customers.last_name}` : booking.group_name || 'Unknown Contact';
        const tourName = booking.tours?.name || 'Unknown Tour';
        const userIds = await getUsersFromDepartments(['operations', 'booking']);

        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'New Booking Created',
            message: `New booking created for ${customerName} on "${tourName}"`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in booking insert notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, async (payload) => {
      console.log('📝 FIXED: Booking updated:', payload.new.id);
      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('*, customers(first_name, last_name), tours(name)')
          .eq('id', payload.new.id)
          .single();

        if (error || !booking) return;

        const customerName = booking.customers ? `${booking.customers.first_name} ${booking.customers.last_name}` : booking.group_name || 'Unknown Contact';
        const tourName = booking.tours?.name || 'Unknown Tour';
        let changeDescription = 'updated';
        if (payload.old?.status !== payload.new?.status) {
          changeDescription = `status changed to ${payload.new.status}`;
        }

        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Booking Updated',
            message: `Booking for ${customerName} on "${tourName}" - ${changeDescription}`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in booking update notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings' }, async (payload) => {
      console.log('🗑️ FIXED: Booking deleted:', payload.old.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Booking Deleted',
            message: `Booking has been deleted from the system`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.old.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in booking delete notification:', error);
      }
    });

    // TOURS - Insert, Update, Delete
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tours' }, async (payload) => {
      console.log('🆕 FIXED: New tour detected:', payload.new);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'New Tour Created',
            message: `New tour "${payload.new.name}" has been created`,
            type: 'tour',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in tour insert notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tours' }, async (payload) => {
      console.log('📝 FIXED: Tour updated:', payload.new.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Tour Updated',
            message: `Tour "${payload.new.name}" has been updated`,
            type: 'tour',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in tour update notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tours' }, async (payload) => {
      console.log('🗑️ FIXED: Tour deleted:', payload.old.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Tour Deleted',
            message: `Tour "${payload.old.name}" has been deleted`,
            type: 'tour',
            priority: 'medium',
            related_id: payload.old.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in tour delete notification:', error);
      }
    });

    // TASKS - Insert, Update, Delete
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, async (payload) => {
      console.log('🆕 FIXED: New task detected:', payload.new);
      try {
        const userIds = await getTaskUsers(payload.new.id);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'New Task Created',
            message: `New task "${payload.new.title}" has been created`,
            type: 'task',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in task insert notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, async (payload) => {
      console.log('📝 FIXED: Task updated:', payload.new.id);
      try {
        const userIds = await getTaskUsers(payload.new.id);
        if (userIds.length > 0) {
          let message = `Task "${payload.new.title}" has been updated`;
          if (payload.old?.status !== payload.new?.status) {
            message = `Task "${payload.new.title}" status changed to ${payload.new.status}`;
          }
          await createNotificationForUsers(userIds, {
            title: 'Task Updated',
            message,
            type: 'task',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in task update notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, async (payload) => {
      console.log('🗑️ FIXED: Task deleted:', payload.old.id);
      try {
        const userIds = await getUsersFromDepartments(['operations']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Task Deleted',
            message: `Task "${payload.old.title}" has been deleted`,
            type: 'task',
            priority: 'medium',
            related_id: payload.old.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in task delete notification:', error);
      }
    });

    // ACTIVITIES - Insert, Update, Delete
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, async (payload) => {
      console.log('🆕 FIXED: New activity detected:', payload.new);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'New Activity Created',
            message: `New activity "${payload.new.name}" has been created`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in activity insert notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activities' }, async (payload) => {
      console.log('📝 FIXED: Activity updated:', payload.new.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Activity Updated',
            message: `Activity "${payload.new.name}" has been updated`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in activity update notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activities' }, async (payload) => {
      console.log('🗑️ FIXED: Activity deleted:', payload.old.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Activity Deleted',
            message: `Activity "${payload.old.name}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.old.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in activity delete notification:', error);
      }
    });

    // HOTELS - Insert, Update, Delete
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hotels' }, async (payload) => {
      console.log('🆕 FIXED: New hotel detected:', payload.new);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'New Hotel Created',
            message: `New hotel "${payload.new.name}" has been created`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in hotel insert notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hotels' }, async (payload) => {
      console.log('📝 FIXED: Hotel updated:', payload.new.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Hotel Updated',
            message: `Hotel "${payload.new.name}" has been updated`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.new.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in hotel update notification:', error);
      }
    });

    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hotels' }, async (payload) => {
      console.log('🗑️ FIXED: Hotel deleted:', payload.old.id);
      try {
        const userIds = await getUsersFromDepartments(['operations', 'booking']);
        if (userIds.length > 0) {
          await createNotificationForUsers(userIds, {
            title: 'Hotel Deleted',
            message: `Hotel "${payload.old.name}" has been deleted`,
            type: 'booking',
            priority: 'medium',
            related_id: payload.old.id
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (error) {
        console.error('❌ Error in hotel delete notification:', error);
      }
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('📡 FIXED Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ FIXED: Successfully subscribed to real-time notifications');
        isSubscribedRef.current = true;
        channelRef.current = channel;
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ FIXED: Channel subscription error');
        isSubscribedRef.current = false;
      } else if (status === 'TIMED_OUT') {
        console.error('❌ FIXED: Channel subscription timed out');
        isSubscribedRef.current = false;
      }
    });

    // Cleanup function
    return () => {
      console.log('🧹 FIXED: Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [user?.id, queryClient]);

  return {
    isSubscribed: isSubscribedRef.current,
    channel: channelRef.current
  };
};