
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRealtimeTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
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
        (payload) => {
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
        (payload) => {
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
        (payload) => {
          console.log('New task assignment:', payload.new);
          
          // Invalidate tasks queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
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
        (payload) => {
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
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tours'
        },
        (payload) => {
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
          }
        }
      )
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('Booking change:', payload);
          
          // Invalidate bookings queries
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(toursChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [queryClient, toast]);
};
