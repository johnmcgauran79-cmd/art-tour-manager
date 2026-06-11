import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PersonalTodo {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const usePersonalTodos = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["personal_todos", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_todos")
        .select("*")
        .order("completed", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PersonalTodo[];
    },
    enabled: !!user?.id,
  });
};

export const useCreateTodo = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { title: string; due_date?: string | null }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("personal_todos")
        .insert({ title: input.title, due_date: input.due_date ?? null, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_todos"] }),
    onError: (e: any) => toast({ title: "Could not add to-do", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PersonalTodo> & { id: string }) => {
      const { error } = await supabase.from("personal_todos").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_todos"] }),
    onError: (e: any) => toast({ title: "Could not update to-do", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_todos"] }),
    onError: (e: any) => toast({ title: "Could not delete to-do", description: e.message, variant: "destructive" }),
  });
};