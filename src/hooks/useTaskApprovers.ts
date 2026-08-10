import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ApprovalDecision = "pending" | "approved" | "changes_requested";
export type ApprovalPolicy = "any" | "all";

export interface TaskApproverRow {
  id: string;
  task_id: string;
  user_id: string;
  requested_by: string | null;
  requested_at: string;
  decision: ApprovalDecision;
  decided_at: string | null;
  notes: string | null;
  user?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

export const useTaskApprovers = (taskId: string | undefined) => {
  return useQuery({
    queryKey: ["task-approvers", taskId],
    queryFn: async (): Promise<TaskApproverRow[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_approvers")
        .select("*")
        .eq("task_id", taskId)
        .order("requested_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return rows.map((r) => ({ ...r, user: map.get(r.user_id) || null })) as TaskApproverRow[];
    },
    enabled: !!taskId,
  });
};

export const useRequestApproval = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { taskId: string; userIds: string[]; policy?: ApprovalPolicy }) => {
      const { taskId, userIds, policy } = params;
      if (!userIds.length) return { added: 0 };
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = authUser.user?.id;
      if (!actorId) throw new Error("Not authenticated");

      // Auto-assign each approver to the task (if not already assigned)
      const { data: existingAssignments } = await supabase
        .from("task_assignments")
        .select("user_id")
        .eq("task_id", taskId)
        .in("user_id", userIds);
      const assignedSet = new Set((existingAssignments || []).map((a: any) => a.user_id));
      const toAssign = userIds.filter((u) => !assignedSet.has(u));
      if (toAssign.length) {
        await supabase.from("task_assignments").insert(
          toAssign.map((uid) => ({ task_id: taskId, user_id: uid, assigned_by: actorId }))
        );
      }

      // Insert approvers (ignore duplicates)
      const { error } = await supabase.from("task_approvers").upsert(
        userIds.map((uid) => ({
          task_id: taskId,
          user_id: uid,
          requested_by: actorId,
          decision: "pending" as const,
        })),
        { onConflict: "task_id,user_id", ignoreDuplicates: true }
      );
      if (error) throw error;

      // Set task status to approval_required and store policy
      await supabase
        .from("tasks")
        .update({
          status: "approval_required" as any,
          ...(policy ? { approval_policy: policy } : {}),
        } as any)
        .eq("id", taskId);

      // Log activity
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        actor_id: actorId,
        event_type: "approval_requested",
        message: `Requested approval from ${userIds.length} ${userIds.length === 1 ? "person" : "people"}${
          policy ? ` (${policy === "any" ? "any one" : "all required"})` : ""
        }`,
        new_value: { policy: policy || null, count: userIds.length },
      });

      // Notification is dispatched server-side by the task_approvers trigger
      // (trg_notify_task_approval_request) so it can never be lost if the
      // browser request fails or the session token has expired.

      return { added: userIds.length };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["task-approvers", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["task-assignments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-pending-approvals"] });
      toast({ title: "Approval requested", description: "Approvers have been notified." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to request approval", variant: "destructive" });
    },
  });
};

export const useReRequestApproval = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { taskId: string }) => {
      const { taskId } = params;
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = authUser.user?.id;
      if (!actorId) throw new Error("Not authenticated");

      // Reset all decisions to pending
      const { data: existing } = await supabase
        .from("task_approvers")
        .select("user_id")
        .eq("task_id", taskId);
      const userIds = (existing || []).map((r: any) => r.user_id);
      if (!userIds.length) throw new Error("No approvers to re-request from");

      await supabase
        .from("task_approvers")
        .update({ decision: "pending", notes: null, decided_at: null, requested_at: new Date().toISOString() })
        .eq("task_id", taskId);

      // Set task back to approval_required
      await supabase
        .from("tasks")
        .update({ status: "approval_required" as any })
        .eq("id", taskId);

      // Activity
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        actor_id: actorId,
        event_type: "approval_re_requested",
        message: `Re-requested approval from ${userIds.length} ${userIds.length === 1 ? "person" : "people"}`,
      });

      // Notification dispatched server-side by the task_approvers trigger.

      return { count: userIds.length };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["task-approvers", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["task-activity", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["task", vars.taskId] });
      toast({ title: "Approval re-requested", description: "Approvers have been notified." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to re-request approval", variant: "destructive" });
    },
  });
};

export const useRemoveApprover = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { id: string; taskId: string }) => {
      const { error } = await supabase.from("task_approvers").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["task-approvers", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["my-pending-approvals"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to remove approver", variant: "destructive" });
    },
  });
};

export const useRecordApprovalDecision = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: { id: string; taskId: string; decision: ApprovalDecision; notes?: string }) => {
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = authUser.user?.id;
      if (!actorId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("task_approvers")
        .update({
          decision: params.decision,
          notes: params.notes?.trim() || null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      if (error) throw error;

      // Re-fetch all approvers + task policy to determine resulting status
      const [{ data: allApprovers }, { data: taskRow }] = await Promise.all([
        supabase
          .from("task_approvers")
          .select("user_id, decision, requested_by")
          .eq("task_id", params.taskId),
        supabase.from("tasks").select("approval_policy").eq("id", params.taskId).single(),
      ]);

      const rows = (allApprovers || []) as any[];
      const policy = ((taskRow as any)?.approval_policy as ApprovalPolicy) || "all";
      const anyChanges = rows.some((r) => r.decision === "changes_requested");
      const anyApproved = rows.some((r) => r.decision === "approved");
      const allApproved = rows.length > 0 && rows.every((r) => r.decision === "approved");

      let newStatus: string | null = null;
      if (anyChanges) newStatus = "changes_needed";
      else if (policy === "any" && anyApproved) newStatus = "approved";
      else if (policy === "all" && allApproved) newStatus = "approved";

      if (newStatus) {
        await supabase
          .from("tasks")
          .update({ status: newStatus as any })
          .eq("id", params.taskId);
      }

      // Log to task activity feed
      await supabase.from("task_activity_log").insert({
        task_id: params.taskId,
        actor_id: actorId,
        event_type:
          params.decision === "approved"
            ? "approval_approved"
            : params.decision === "changes_requested"
            ? "approval_changes_requested"
            : "approval_decision",
        message: params.notes?.trim() || null,
        new_value: { decision: params.decision },
      });

      // Notify the requester(s) — dedupe and exclude the actor themselves
      const requesterIds = Array.from(
        new Set(rows.map((r) => r.requested_by).filter((id) => id && id !== actorId))
      ) as string[];
      if (requesterIds.length) {
        supabase.functions
          .invoke("send-task-notification", {
            body: {
              type: "approval_decision",
              taskId: params.taskId,
              recipientUserIds: requesterIds,
              actorUserId: actorId,
              decision: params.decision,
              resultingStatus: newStatus,
              message: params.notes?.trim() || undefined,
            },
          })
          .catch((e) => console.error("Notification failed:", e));
      }

      return { newStatus };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["task-approvers", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["task-activity", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["task", vars.taskId] });
      toast({ title: "Decision recorded" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to record decision", variant: "destructive" });
    },
  });
};