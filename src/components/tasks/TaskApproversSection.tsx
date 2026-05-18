import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, UserPlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useTaskApprovers,
  useRecordApprovalDecision,
  useRemoveApprover,
} from "@/hooks/useTaskApprovers";
import { RequestApprovalDialog } from "./RequestApprovalDialog";
import { format } from "date-fns";

interface Props {
  taskId: string;
}

export const TaskApproversSection = ({ taskId }: Props) => {
  const { user } = useAuth();
  const { data: approvers } = useTaskApprovers(taskId);
  const decide = useRecordApprovalDecision();
  const remove = useRemoveApprover();
  const [dialogOpen, setDialogOpen] = useState(false);

  const displayName = (u: any) =>
    u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email : "Unknown";

  const decisionBadge = (d: string) => {
    if (d === "approved")
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (d === "changes_requested")
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Changes Requested</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {approvers && approvers.length > 0
            ? `${approvers.length} approver${approvers.length === 1 ? "" : "s"} requested`
            : "No approvers requested yet"}
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Add approver
        </Button>
      </div>

      {approvers && approvers.length > 0 && (
        <div className="space-y-2">
          {approvers.map((a) => {
            const isMine = a.user_id === user?.id && a.decision === "pending";
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{displayName(a.user)}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.decided_at
                      ? `Decided ${format(new Date(a.decided_at), "dd/MM/yyyy HH:mm")}`
                      : `Requested ${format(new Date(a.requested_at), "dd/MM/yyyy HH:mm")}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {decisionBadge(a.decision)}
                  {isMine && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decide.mutate({ id: a.id, taskId, decision: "approved" })}
                        disabled={decide.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decide.mutate({ id: a.id, taskId, decision: "changes_requested" })}
                        disabled={decide.isPending}
                      >
                        Request changes
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => remove.mutate({ id: a.id, taskId })}
                    title="Remove approver"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RequestApprovalDialog taskId={taskId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};