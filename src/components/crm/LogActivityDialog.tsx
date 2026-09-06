import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogActivity } from "@/hooks/useCrm";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { ACTIVITY_DIRECTIONS, ACTIVITY_OUTCOMES, ACTIVITY_TYPES } from "@/lib/crm/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string | null;
  leadId?: string | null;
  contactName?: string;
  defaultType?: string;
}

const NONE = "__none__";

/** Fast "what just happened" logger: call, note, meeting, complaint and so on. */
export function LogActivityDialog({
  open,
  onOpenChange,
  customerId,
  leadId,
  contactName,
  defaultType = "call",
}: Props) {
  const log = useLogActivity();
  const { data: users = [] } = useAssignableUsers();

  const [type, setType] = useState(defaultType);
  const [direction, setDirection] = useState("outbound");
  const [outcome, setOutcome] = useState(NONE);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionNote, setNextActionNote] = useState("");
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [assignee, setAssignee] = useState(NONE);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setDirection("outbound");
    setOutcome(NONE);
    setSubject("");
    setBody("");
    setOccurredAt("");
    setNextActionDate("");
    setNextActionNote("");
    setCreateTask(false);
    setTaskTitle("");
    setAssignee(NONE);
  }, [open, defaultType]);

  const save = async () => {
    await log.mutateAsync({
      customer_id: customerId || null,
      lead_id: leadId || null,
      activity_type: type,
      direction: ["call", "email", "voicemail"].includes(type) ? direction : null,
      outcome: outcome === NONE ? null : outcome,
      subject: subject || null,
      body: body || null,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      next_action_date: leadId ? nextActionDate || null : undefined,
      next_action_note: leadId ? nextActionNote || null : undefined,
      followUp:
        createTask && taskTitle
          ? {
              title: taskTitle,
              due_date: nextActionDate || null,
              assignee_ids: assignee === NONE ? [] : [assignee],
              crm_type: type === "call" ? "call" : "sales_follow_up",
            }
          : null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log activity{contactName ? ` — ${contactName}` : ""}</DialogTitle>
          <DialogDescription>
            Record what happened and, if needed, set the next follow-up in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">What happened</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {["call", "email", "voicemail"].includes(type) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue placeholder="Not recorded" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not recorded</SelectItem>
                {ACTIVITY_OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">When</Label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Summary</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short heading" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Details</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          {leadId && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Next action date</Label>
                <Input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Next action</Label>
                <Input
                  value={nextActionNote}
                  onChange={(e) => setNextActionNote(e.target.value)}
                  placeholder="Send Royal Ascot pricing"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2 space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Also create a follow-up task</Label>
              <Switch checked={createTask} onCheckedChange={setCreateTask} />
            </div>
            {createTask && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Task title</Label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={`Follow up${contactName ? ` with ${contactName}` : ""}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assign to</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger><SelectValue placeholder="Nobody yet" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nobody yet</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={log.isPending}>Save activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
