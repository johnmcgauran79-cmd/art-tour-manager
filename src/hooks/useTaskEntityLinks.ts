import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/lib/entityLinks";

export interface TaskEntityLinkRow {
  id: string;
  task_id: string;
  entity_type: EntityType;
  entity_id: string;
  source: "description" | "comment" | "manual";
  source_id: string | null;
  created_at: string;
}

/** Fetch the linked entities for a task (extracted from description + comments). */
export const useTaskEntityLinks = (taskId: string | undefined) => {
  return useQuery({
    queryKey: ["task-entity-links", taskId],
    queryFn: async (): Promise<TaskEntityLinkRow[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_entity_links")
        .select("*")
        .eq("task_id", taskId);
      if (error) throw error;
      return (data || []) as TaskEntityLinkRow[];
    },
    enabled: !!taskId,
  });
};

/** Fetch all tasks that link to a given entity (reverse view). */
export const useTasksLinkedToEntity = (entityType: EntityType, entityId: string | undefined) => {
  return useQuery({
    queryKey: ["tasks-linked-to-entity", entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data: links, error } = await supabase
        .from("task_entity_links")
        .select("task_id")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      const taskIds = Array.from(new Set((links || []).map((l: any) => l.task_id)));
      if (taskIds.length === 0) return [];
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, category, tour_id")
        .in("id", taskIds)
        .neq("status", "archived")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (tErr) throw tErr;
      return tasks || [];
    },
    enabled: !!entityId,
  });
};
/** Attach a record to a task by hand (source = "manual"). */
export const useAddTaskEntityLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; entityType: EntityType; entityId: string }) => {
      const { error } = await supabase.from("task_entity_links").insert({
        task_id: input.taskId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        source: "manual",
      });
      // Ignore the duplicate-key case: the record is already linked.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["task-entity-links", v.taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks-linked-to-entity"] });
    },
  });
};

/** Remove a hand-added link from a task. */
export const useRemoveTaskEntityLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; taskId: string }) => {
      const { error } = await supabase.from("task_entity_links").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["task-entity-links", v.taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks-linked-to-entity"] });
    },
  });
};
