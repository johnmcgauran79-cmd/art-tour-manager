import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/lib/entityLinks";

export interface TaskEntityLinkRow {
  id: string;
  task_id: string;
  entity_type: EntityType;
  entity_id: string;
  source: "description" | "comment";
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