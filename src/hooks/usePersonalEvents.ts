import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PersonalEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

export const usePersonalEvents = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["personal_events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as PersonalEvent[];
    },
    enabled: !!user?.id,
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<PersonalEvent, "id" | "user_id" | "created_at" | "updated_at">) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("personal_events")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as PersonalEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_events"] }),
    onError: (e: any) => toast({ title: "Could not create event", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PersonalEvent> & { id: string }) => {
      const { error } = await supabase.from("personal_events").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_events"] }),
    onError: (e: any) => toast({ title: "Could not update event", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_events"] }),
    onError: (e: any) => toast({ title: "Could not delete event", description: e.message, variant: "destructive" }),
  });
};