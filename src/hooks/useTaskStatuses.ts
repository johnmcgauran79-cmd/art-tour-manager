import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setTaskStatusesCache, type TaskStatusOption } from "@/lib/taskStatuses";

export interface TaskStatusRow {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_finished: boolean;
  is_system: boolean;
}

export const useTaskStatuses = () => {
  const query = useQuery({
    queryKey: ["task_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskStatusRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Keep the synchronous lib cache hydrated for non-hook consumers.
  useEffect(() => {
    if (query.data?.length) {
      const options: TaskStatusOption[] = query.data.map((r) => ({
        value: r.value,
        label: r.label,
        is_finished: r.is_finished,
        sort_order: r.sort_order,
      }));
      setTaskStatusesCache(options);
    }
  }, [query.data]);

  return query;
};

export const useCreateTaskStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      input: { value: string; label: string; sort_order: number; is_finished: boolean },
    ) => {
      const { data, error } = await supabase
        .from("task_statuses")
        .insert({ ...input, is_system: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_statuses"] });
      toast({ title: "Status added" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to add status", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateTaskStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      input: { id: string; label?: string; sort_order?: number; is_finished?: boolean },
    ) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("task_statuses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_statuses"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteTaskStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_statuses"] });
      toast({ title: "Status removed" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove status", description: e.message, variant: "destructive" }),
  });
};