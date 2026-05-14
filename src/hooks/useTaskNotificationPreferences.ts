import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type TaskNotifChannel = "off" | "email" | "teams" | "both";
export type TaskDigestCadence = "daily" | "weekly" | "custom_weekdays";

export interface TaskNotificationPreferences {
  user_id: string;
  alerts_channel: TaskNotifChannel;
  digest_channel: TaskNotifChannel;
  scope_assigned: boolean;
  scope_watching: boolean;
  scope_mentioned: boolean;
  alerts_enabled: boolean;
  alert_thresholds_hours: number[];
  alert_on_overdue: boolean;
  overdue_reminder_interval_hours: number;
  alert_priority_filter: string[];
  digest_enabled: boolean;
  digest_cadence: TaskDigestCadence;
  digest_weekdays: number[];
  digest_time_local: string; // "HH:MM" or "HH:MM:SS"
  digest_lookahead_days: number;
  digest_include_overdue: boolean;
  digest_include_due_today: boolean;
  digest_include_upcoming: boolean;
  digest_include_newly_assigned: boolean;
  digest_include_watched: boolean;
  digest_include_subtasks: boolean;
  digest_skip_if_empty: boolean;
  digest_priority_filter: string[];
  last_digest_sent_at: string | null;
}

const DEFAULTS = (userId: string): TaskNotificationPreferences => ({
  user_id: userId,
  alerts_channel: "email",
  digest_channel: "email",
  scope_assigned: true,
  scope_watching: false,
  scope_mentioned: false,
  alerts_enabled: true,
  alert_thresholds_hours: [24],
  alert_on_overdue: true,
  overdue_reminder_interval_hours: 24,
  alert_priority_filter: [],
  digest_enabled: false,
  digest_cadence: "daily",
  digest_weekdays: [1, 2, 3, 4, 5],
  digest_time_local: "08:00",
  digest_lookahead_days: 7,
  digest_include_overdue: true,
  digest_include_due_today: true,
  digest_include_upcoming: true,
  digest_include_newly_assigned: true,
  digest_include_watched: false,
  digest_include_subtasks: true,
  digest_skip_if_empty: true,
  digest_priority_filter: [],
  last_digest_sent_at: null,
});

export function useTaskNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["task-notification-preferences", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<TaskNotificationPreferences> => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("task_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULTS(user.id);
      // Normalise time to HH:MM
      const t = (data as any).digest_time_local as string;
      if (t && t.length > 5) (data as any).digest_time_local = t.slice(0, 5);
      return data as TaskNotificationPreferences;
    },
  });
}

export function useSaveTaskNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (prefs: TaskNotificationPreferences) => {
      if (!user?.id) throw new Error("Not authenticated");
      const payload = { ...prefs, user_id: user.id };
      const { error } = await supabase
        .from("task_notification_preferences")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-notification-preferences"] });
      toast({ title: "Notification settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });
}

export function useSendTestTaskDigest() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-task-digests", {
        body: { test: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test digest sent",
        description: data?.summary || "Check your inbox.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });
}