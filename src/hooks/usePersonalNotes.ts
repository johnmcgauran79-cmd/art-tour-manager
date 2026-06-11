import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PersonalNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export const usePersonalNotes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["personal_notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_notes")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as PersonalNote[];
    },
    enabled: !!user?.id,
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input?: { title?: string; content?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("personal_notes")
        .insert({ title: input?.title ?? "Untitled note", content: input?.content ?? "", user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as PersonalNote;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_notes"] }),
    onError: (e: any) => toast({ title: "Could not create note", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PersonalNote> & { id: string }) => {
      const { error } = await supabase.from("personal_notes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_notes"] }),
    onError: (e: any) => toast({ title: "Could not save note", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personal_notes"] }),
    onError: (e: any) => toast({ title: "Could not delete note", description: e.message, variant: "destructive" }),
  });
};