import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface PendingApprovalRow {
  id: string;
  task_id: string;
  requested_at: string;
  task: {
    id: string;
    title: string;
    due_date: string | null;
    priority: string | null;
  } | null;
  requester: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export const MyApprovalsWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["my-pending-approvals", user?.id],
    queryFn: async (): Promise<PendingApprovalRow[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("task_approvers")
        .select("id, task_id, requested_at, requested_by")
        .eq("user_id", user.id)
        .eq("decision", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (!rows.length) return [];

      const taskIds = Array.from(new Set(rows.map((r) => r.task_id)));
      const requesterIds = Array.from(
        new Set(rows.map((r) => r.requested_by).filter(Boolean))
      );

      const [{ data: tasks }, { data: profiles }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, due_date, priority, status")
          .in("id", taskIds),
        requesterIds.length
          ? supabase
              .from("profiles")
              .select("id, first_name, last_name, email")
              .in("id", requesterIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const taskMap = new Map((tasks || []).map((t: any) => [t.id, t]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return rows
        // Only show approvals for tasks that are still awaiting a decision.
        // Tasks that are already approved/completed/closed (e.g. "any one"
        // policy resolved by another approver, or the task was completed)
        // should not keep appearing as outstanding for this user.
        .filter((r) => {
          const t = taskMap.get(r.task_id);
          return t && t.status === "approval_required";
        })
        .map((r) => ({
          id: r.id,
          task_id: r.task_id,
          requested_at: r.requested_at,
          task: taskMap.get(r.task_id) || null,
          requester: r.requested_by ? profileMap.get(r.requested_by) || null : null,
        }));
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  const displayName = (p: PendingApprovalRow["requester"]) =>
    p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Someone" : "Someone";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="h-4 w-4 text-primary" />
          My Approvals
          {approvals && approvals.length > 0 && (
            <Badge variant="secondary" className="ml-1">{approvals.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!approvals || approvals.length === 0) && (
          <p className="text-sm text-muted-foreground">Nothing waiting on you 🎉</p>
        )}
        {approvals?.slice(0, 5).map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/tasks/${a.task_id}`)}
            className="w-full text-left p-2 rounded-md border hover:bg-muted transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {a.task?.title || "Untitled task"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  From {displayName(a.requester)}
                  {a.task?.due_date && ` · Due ${format(new Date(a.task.due_date), "dd/MM/yyyy")}`}
                </p>
              </div>
              <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            </div>
          </button>
        ))}
        {approvals && approvals.length > 5 && (
          <Button
            variant="link"
            size="sm"
            className="px-0"
            onClick={() => navigate("/?tab=tasks")}
          >
            View all {approvals.length} pending approvals
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
