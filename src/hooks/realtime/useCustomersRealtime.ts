
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/utils/notificationHelpers";

export const useCustomersRealtime = (userId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

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
          
          queryClient.invalidateQueries({ queryKey: ['customers'] });

          const oldCustomer = payload.old as any;
          const newCustomer = payload.new as any;
          
          if (oldCustomer.dietary_requirements !== newCustomer.dietary_requirements) {
            await createNotification(userId, {
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
          
          queryClient.invalidateQueries({ queryKey: ['customers'] });

          const deletedCustomer = payload.old as any;
          await createNotification(userId, {
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
      console.log('Cleaning up customers real-time subscriptions...');
      supabase.removeChannel(customersChannel);
    };
  }, [queryClient, userId]);
};
