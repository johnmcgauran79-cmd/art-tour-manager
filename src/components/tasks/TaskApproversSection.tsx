import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, UserPlus, X, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useTaskApprovers,
  useRecordApprovalDecision,
  useRemoveApprover,
  useReRequestApproval,
  ApprovalDecision,
} from "@/hooks/useTaskApprovers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { RequestApprovalDialog } from "./RequestApprovalDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface Props {
  taskId: string;
}

export const TaskApproversSection = ({ taskId }: Props) => {
  const { user } = useAuth();
  const { data: approvers } = useTaskApprovers(taskId);
  const decide = useRecordApprovalDecision();
  const remove = useRemoveApprover();
  const reRequest = useReRequestApproval();
  const { data: taskMeta } = useQuery({
    queryKey: ["task-approval-meta", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("approval_policy, status")
        .eq("id", taskId)
        .single();
      return data as { approval_policy: "any" | "all" | null; status: string } | null;
    },
    enabled: !!taskId,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState<{
    open: boolean;
    approverId: string;
    decision: ApprovalDecision;
  } | null>(null);
  const [notes, setNotes] = useState("");

  const openDecisionDialog = (approverId: string, decision: ApprovalDecision) => {
    setNotes("");
    setDecisionDialog({ open: true, approverId, decision });
  };

  const submitDecision = async () => {
    if (!decisionDialog) return;
    await decide.mutateAsync({
      id: decisionDialog.approverId,
      taskId,
      decision: decisionDialog.decision,
      notes: notes.trim() || undefined,
    });
    setDecisionDialog(null);
  };

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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {approvers && approvers.length > 0
              ? `${approvers.length} approver${approvers.length === 1 ? "" : "s"} requested`
              : "No approvers requested yet"}
          </div>
          {taskMeta?.approval_policy && approvers && approvers.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {taskMeta.approval_policy === "any" ? "Any one approves" : "All required"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {taskMeta?.status === "changes_needed" && approvers && approvers.length > 0 && (
            <Button
              size="sm"
              variant="default"
              onClick={() => reRequest.mutate({ taskId })}
              disabled={reRequest.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Re-request approval
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add approver
          </Button>
        </div>
      </div>

      {approvers && approvers.length > 0 && (
        <div className="space-y-2">
          {approvers.map((a) => {
            const isMine = a.user_id === user?.id && a.decision === "pending";
            return (
              <div key={a.id} className="p-2 rounded-md border">
                <div className="flex items-center justify-between gap-2">
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
                        onClick={() => openDecisionDialog(a.id, "approved")}
                        disabled={decide.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDecisionDialog(a.id, "changes_requested")}
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
              {a.notes && (
                <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-border pl-2">
                  "{a.notes}"
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      <RequestApprovalDialog taskId={taskId} open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog
        open={!!decisionDialog?.open}
        onOpenChange={(o) => !o && setDecisionDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionDialog?.decision === "approved" ? "Approve task" : "Request changes"}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog?.decision === "approved"
                ? "Optionally add a note for the requester."
                : "Tell the requester what needs to change."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-notes">Notes {decisionDialog?.decision === "changes_requested" ? "(recommended)" : "(optional)"}</Label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                decisionDialog?.decision === "approved"
                  ? "Looks good!"
                  : "Please update the date and resend…"
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={decide.isPending}>
              {decide.isPending
                ? "Saving…"
                : decisionDialog?.decision === "approved"
                ? "Approve"
                : "Request changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};