import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useRequestApproval, useTaskApprovers, ApprovalPolicy } from "@/hooks/useTaskApprovers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export const RequestApprovalDialog = ({ taskId, open, onOpenChange, onCompleted }: Props) => {
  const { data: users } = useAssignableUsers();
  const { data: existingApprovers } = useTaskApprovers(taskId);
  const request = useRequestApproval();
  const [selected, setSelected] = useState<string[]>([]);
  const [policy, setPolicy] = useState<ApprovalPolicy>("all");

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setPolicy("all");
    }
  }, [open]);

  const existingIds = new Set((existingApprovers || []).map((a) => a.user_id));
  const candidates = (users || []).filter((u) => !existingIds.has(u.id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const displayName = (u: { first_name: string | null; last_name: string | null; email: string | null }) =>
    `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Unknown";

  const submit = async () => {
    if (!selected.length) return;
    await request.mutateAsync({ taskId, userIds: selected, policy });
    onOpenChange(false);
    onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Approval</DialogTitle>
          <DialogDescription>
            Choose who needs to approve this task. They'll be auto-assigned and notified via their preferred channel (Teams by default).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-2">
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">No more users available to add.</p>
            )}
            {candidates.map((u) => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded-md hover:bg-muted p-2">
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                <span className="text-sm">{displayName(u)}</span>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2 pt-2 border-t">
          <Label className="text-sm">Approval policy</Label>
          <RadioGroup value={policy} onValueChange={(v) => setPolicy(v as ApprovalPolicy)}>
            <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
              <RadioGroupItem value="all" id="policy-all" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">All required</div>
                <div className="text-xs text-muted-foreground">Every approver must approve before the task is marked approved.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md hover:bg-muted">
              <RadioGroupItem value="any" id="policy-any" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Any one is enough</div>
                <div className="text-xs text-muted-foreground">First approval marks the task approved. Good for quick comms sign-off.</div>
              </div>
            </label>
          </RadioGroup>
        </div>

        {existingApprovers && existingApprovers.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Already requested from: {existingApprovers.map((a) => a.user ? displayName(a.user) : "?").join(", ")}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!selected.length || request.isPending}>
            {request.isPending ? "Requesting…" : `Request from ${selected.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};