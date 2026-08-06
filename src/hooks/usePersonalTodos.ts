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
  notes: string | null;
  converted_task_id: string | null;
}

export interface PersonalTodoShare {
  id: string;
  todo_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
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
    mutationFn: async (input: { title: string; due_date?: string | null; notes?: string | null }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("personal_todos")
        .insert({
          title: input.title,
          due_date: input.due_date ?? null,
          notes: input.notes ?? null,
          user_id: user.id,
        })
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

/** Everyone a to-do has been shared with. */
export const useTodoShares = (todoId?: string) => {
  return useQuery({
    queryKey: ["personal_todo_shares", todoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_todo_shares")
        .select("*")
        .eq("todo_id", todoId!);
      if (error) throw error;
      return data as PersonalTodoShare[];
    },
    enabled: !!todoId,
  });
};

/** Shares across every to-do visible to the current user (for list badges). */
export const useAllTodoShares = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal_todo_shares", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personal_todo_shares").select("*");
      if (error) throw error;
      return data as PersonalTodoShare[];
    },
    enabled: !!user?.id,
  });
};

export const useShareTodo = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ todoId, userIds }: { todoId: string; userIds: string[] }) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (userIds.length === 0) return;

      const { error } = await supabase.from("personal_todo_shares").insert(
        userIds.map((uid) => ({ todo_id: todoId, user_id: uid, added_by: user.id }))
      );
      if (error) throw error;

      // Notify the new people (Teams / email / in-app) — never block the UI on it.
      supabase.functions
        .invoke("send-task-notification", {
          body: {
            type: "todo_share",
            todoId,
            recipientUserIds: userIds,
            actorUserId: user.id,
          },
        })
        .catch((err) => console.error("Failed to send to-do share notification:", err));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_todo_shares"] });
      queryClient.invalidateQueries({ queryKey: ["personal_todos"] });
      toast({ title: "To-do shared" });
    },
    onError: (e: any) => toast({ title: "Could not share to-do", description: e.message, variant: "destructive" }),
  });
};

export const useUnshareTodo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ todoId, userId }: { todoId: string; userId: string }) => {
      const { error } = await supabase
        .from("personal_todo_shares")
        .delete()
        .eq("todo_id", todoId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_todo_shares"] });
      queryClient.invalidateQueries({ queryKey: ["personal_todos"] });
    },
    onError: (e: any) => toast({ title: "Could not remove person", description: e.message, variant: "destructive" }),
  });
};

/**
 * Promote a short personal to-do into a full Task (links, approvals, comments…).
 * Everyone the to-do was shared with becomes a task assignee, and the to-do is
 * kept as a completed, linked record so nothing disappears from anyone's list.
 */
export const useConvertTodoToTask = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ todo, keepTodo = true }: { todo: PersonalTodo; keepTodo?: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: shares, error: sharesError } = await supabase
        .from("personal_todo_shares")
        .select("user_id")
        .eq("todo_id", todo.id);
      if (sharesError) throw sharesError;

      const assigneeIds = Array.from(
        new Set([todo.user_id, ...(shares || []).map((s: any) => s.user_id as string)])
      );

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: todo.title,
          description: todo.notes || null,
          priority: "medium" as const,
          category: "general" as const,
          due_date: todo.due_date,
          status: "not_started" as const,
          created_by: user.id,
          is_automated: false,
        })
        .select()
        .single();
      if (taskError) throw taskError;

      const { error: assignError } = await supabase.from("task_assignments").insert(
        assigneeIds.map((uid) => ({ task_id: task.id, user_id: uid, assigned_by: user.id }))
      );
      if (assignError) throw assignError;

      supabase.functions
        .invoke("send-task-notification", {
          body: {
            type: "assignment",
            taskId: task.id,
            recipientUserIds: assigneeIds,
            actorUserId: user.id,
            message: todo.notes || undefined,
          },
        })
        .catch((err) => console.error("Failed to send assignment notification:", err));

      if (keepTodo) {
        const { error: linkError } = await supabase
          .from("personal_todos")
          .update({ converted_task_id: task.id, completed: true })
          .eq("id", todo.id);
        if (linkError) throw linkError;
      } else {
        const { error: deleteError } = await supabase
          .from("personal_todos")
          .delete()
          .eq("id", todo.id);
        if (deleteError) throw deleteError;
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_todos"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast({ title: "Converted to a Task" });
    },
    onError: (e: any) => toast({ title: "Could not convert to-do", description: e.message, variant: "destructive" }),
  });
};