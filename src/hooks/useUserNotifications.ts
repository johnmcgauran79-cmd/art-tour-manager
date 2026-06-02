import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  priority: string;
  related_id: string | null;
  read: boolean;
  acknowledged: boolean;
  created_at: string;
  updated_at: string;
}

export const useUserNotifications = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["user-notifications", userId],
    queryFn: async (): Promise<UserNotification[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as UserNotification[];
    },
    enabled: !!userId,
  });

  // Realtime: refresh the list whenever a notification row changes for this user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["user-notifications", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const unreadCount = (query.data || []).filter((n) => !n.read).length;

  return { ...query, notifications: query.data || [], unreadCount };
};

export const useMarkNotificationRead = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications", user?.id] }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications", user?.id] }),
  });
};
