import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ScheduledEmail {
  id: string;
  booking_id: string | null;
  tour_id: string | null;
  scheduled_send_at: string;
  status: string;
  email_payload: any;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  error_message: string | null;
  // Joined data
  tour?: { id: string; name: string; start_date: string };
  booking?: { 
    id: string;
    customers: { first_name: string; last_name: string; email: string } | null;
  };
  creator?: { full_name: string } | null;
}

export const useScheduledEmails = () => {
  return useQuery({
    queryKey: ['scheduled-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select(`
          *,
          tour:tours(id, name, start_date),
          booking:bookings(
            id,
            customers:customers!lead_passenger_id(first_name, last_name, email)
          ),
          creator:profiles!scheduled_emails_created_by_fkey(full_name)
        `)
        .in('status', ['scheduled', 'approved'])
        .order('scheduled_send_at', { ascending: true });

      if (error) {
        // If the join on profiles fails (no FK), fetch without it
        if (error.message?.includes('scheduled_emails_created_by_fkey')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('scheduled_emails')
            .select(`
              *,
              tour:tours(id, name, start_date),
              booking:bookings(
                id,
                customers:customers!lead_passenger_id(first_name, last_name, email)
              )
            `)
            .in('status', ['scheduled', 'approved'])
            .order('scheduled_send_at', { ascending: true });
          
          if (fallbackError) throw fallbackError;
          return fallbackData as ScheduledEmail[];
        }
        throw error;
      }
      return data as ScheduledEmail[];
    },
    refetchInterval: 30000,
  });
};

export const useScheduleEmail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bookingIds, 
      tourId, 
      scheduledSendAt, 
      emailPayload 
    }: { 
      bookingIds: string[];
      tourId: string;
      scheduledSendAt: string;
      emailPayload: any;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const rows = bookingIds.map(bookingId => ({
        booking_id: bookingId,
        tour_id: tourId,
        scheduled_send_at: scheduledSendAt,
        status: 'scheduled',
        email_payload: emailPayload,
        created_by: user.id,
      }));

      const { data, error } = await supabase
        .from('scheduled_emails')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      toast({
        title: "Emails Scheduled",
        description: `${data.length} email(s) scheduled successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule emails.",
        variant: "destructive",
      });
    },
  });
};

export const useApproveScheduledEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from('scheduled_emails')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      toast({
        title: "Scheduled Emails Approved",
        description: `${ids.length} email(s) approved. They will send at the scheduled time.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve scheduled emails.",
        variant: "destructive",
      });
    },
  });
};

export const useRejectScheduledEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason?: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from('scheduled_emails')
        .update({
          status: 'rejected',
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      toast({
        title: "Scheduled Emails Rejected",
        description: `${ids.length} email(s) rejected and will not be sent.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject scheduled emails.",
        variant: "destructive",
      });
    },
  });
};

export const useRescheduleEmail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, newSendAt }: { ids: string[]; newSendAt: string }) => {
      const { error } = await supabase
        .from('scheduled_emails')
        .update({ scheduled_send_at: newSendAt })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
      toast({
        title: "Emails Rescheduled",
        description: "The scheduled send time has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule emails.",
        variant: "destructive",
      });
    },
  });
};
