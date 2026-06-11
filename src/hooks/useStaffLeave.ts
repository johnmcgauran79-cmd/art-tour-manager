import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface StaffLeave {
  id: string;
  user_id: string;
  description: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const staffDisplayName = (s?: StaffMember | null) => {
  if (!s) return "Unknown";
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  return name || s.email || "Unknown";
};

// All staff (every profile) — used to pick whose leave admins are adding.
export const useStaffMembers = () => {
  return useQuery({
    queryKey: ["staff-members"],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name");
      if (error) throw error;
      return (data || []) as StaffMember[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useStaffLeave = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["staff_leave"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_leave")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as StaffLeave[];
    },
    enabled: !!user?.id,
  });
};

export const useCreateStaffLeave = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { user_id: string; description: string; start_date: string; end_date: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("staff_leave")
        .insert({ ...input, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as StaffLeave;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff_leave"] }),
    onError: (e: any) => toast({ title: "Could not add leave", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteStaffLeave = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_leave").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff_leave"] }),
    onError: (e: any) => toast({ title: "Could not delete leave", description: e.message, variant: "destructive" }),
  });
};