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
export interface PersonalNoteShare {
  id: string;
  note_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
}

/** Everyone a note has been shared with. */
export const useNoteShares = (noteId?: string) => {
  return useQuery({
    queryKey: ["personal_note_shares", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_note_shares")
        .select("*")
        .eq("note_id", noteId!);
      if (error) throw error;
      return data as PersonalNoteShare[];
    },
    enabled: !!noteId,
  });
};

/** Shares across every note visible to the current user (for list filters/badges). */
export const useAllNoteShares = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal_note_shares", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personal_note_shares").select("*");
      if (error) throw error;
      return data as PersonalNoteShare[];
    },
    enabled: !!user?.id,
  });
};

export const useShareNote = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, userIds }: { noteId: string; userIds: string[] }) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (userIds.length === 0) return;

      const { error } = await supabase
        .from("personal_note_shares")
        .insert(userIds.map((uid) => ({ note_id: noteId, user_id: uid, added_by: user.id })));
      if (error) throw error;

      // Teams / email / in-app notification — never block the UI on it.
      supabase.functions
        .invoke("send-task-notification", {
          body: {
            type: "note_share",
            noteId,
            recipientUserIds: userIds,
            actorUserId: user.id,
          },
        })
        .catch((err) => console.error("Failed to send note share notification:", err));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_note_shares"] });
      queryClient.invalidateQueries({ queryKey: ["personal_notes"] });
      toast({ title: "Note shared" });
    },
    onError: (e: any) =>
      toast({ title: "Could not share note", description: e.message, variant: "destructive" }),
  });
};

export const useUnshareNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, userId }: { noteId: string; userId: string }) => {
      const { error } = await supabase
        .from("personal_note_shares")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_note_shares"] });
      queryClient.invalidateQueries({ queryKey: ["personal_notes"] });
    },
    onError: (e: any) =>
      toast({ title: "Could not remove person", description: e.message, variant: "destructive" }),
  });
};

/** Notify staff newly tagged with `@Name` inside a note's content. */
export const useNotifyNoteMentions = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ noteId, userIds }: { noteId: string; userIds: string[] }) => {
      if (!user?.id || userIds.length === 0) return;
      const recipients = userIds.filter((id) => id !== user.id);
      if (recipients.length === 0) return;
      await supabase.functions.invoke("send-task-notification", {
        body: {
          type: "note_mention",
          noteId,
          recipientUserIds: recipients,
          actorUserId: user.id,
        },
      });
    },
    onError: (e: any) => console.error("Failed to send note mention notification:", e),
  });
};
