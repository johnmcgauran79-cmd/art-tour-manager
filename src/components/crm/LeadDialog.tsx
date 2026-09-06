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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTours } from "@/hooks/useTours";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useCrmConfig, useCreateLead, useUpdateLead, type Lead } from "@/hooks/useCrm";
import { LEAD_PRIORITIES } from "@/lib/crm/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  lead?: Lead | null;
  onSaved?: (leadId?: string) => void;
}

const NONE = "__none__";

export function LeadDialog({ open, onOpenChange, customerId, lead, onSaved }: Props) {
  const { data: config } = useCrmConfig();
  const { data: tours = [] } = useTours();
  const { data: users = [] } = useAssignableUsers();
  const create = useCreateLead();
  const update = useUpdateLead();

  const [form, setForm] = useState({
    lead_type: "register_interest",
    tour_id: NONE,
    stage: "new",
    priority: "normal",
    owner_id: NONE,
    source: NONE,
    passengers: "",
    estimated_value: "",
    companions: "",
    next_action_date: "",
    next_action_note: "",
    notes: "",
    lost_reason: NONE,
    lost_notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      lead_type: lead?.lead_type || "register_interest",
      tour_id: lead?.tour_id || NONE,
      stage: lead?.stage || "new",
      priority: lead?.priority || "normal",
      owner_id: lead?.owner_id || NONE,
      source: lead?.source || NONE,
      passengers: lead?.passengers?.toString() || "",
      estimated_value: lead?.estimated_value?.toString() || "",
      companions: lead?.companions || "",
      next_action_date: lead?.next_action_date || "",
      next_action_note: lead?.next_action_note || "",
      notes: lead?.notes || "",
      lost_reason: lead?.lost_reason || NONE,
      lost_notes: lead?.lost_notes || "",
    });
  }, [open, lead]);

  const stageIsLost = config?.stages.find((s) => s.key === form.stage)?.is_lost;

  const handleSave = async () => {
    const payload: any = {
      lead_type: form.lead_type,
      tour_id: form.tour_id === NONE ? null : form.tour_id,
      stage: form.stage,
      priority: form.priority,
      owner_id: form.owner_id === NONE ? null : form.owner_id,
      source: form.source === NONE ? null : form.source,
      passengers: form.passengers ? Number(form.passengers) : null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      companions: form.companions || null,
      next_action_date: form.next_action_date || null,
      next_action_note: form.next_action_note || null,
      notes: form.notes || null,
      lost_reason: stageIsLost && form.lost_reason !== NONE ? form.lost_reason : null,
      lost_notes: stageIsLost ? form.lost_notes || null : null,
    };

    if (lead) {
      await update.mutateAsync({ id: lead.id, ...payload });
      onSaved?.(lead.id);
    } else if (customerId) {
      const id = await create.mutateAsync({ customer_id: customerId, ...payload });
      onSaved?.(id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit enquiry" : "New enquiry"}</DialogTitle>
          <DialogDescription>
            Each enquiry is its own record, so one person can be interested in several tours at once.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.types || []).map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Stage">
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.stages || []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tour of interest">
            <Select value={form.tour_id} onValueChange={(v) => setForm({ ...form, tour_id: v })}>
              <SelectTrigger><SelectValue placeholder="No specific tour" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No specific tour</SelectItem>
                {tours.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Owner">
            <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Source">
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="Unknown" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unknown</SelectItem>
                {(config?.sources || []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="People travelling">
            <Input
              type="number"
              min={1}
              value={form.passengers}
              onChange={(e) => setForm({ ...form, passengers: e.target.value })}
            />
          </Field>

          <Field label="Estimated value (AUD)">
            <Input
              type="number"
              min={0}
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
            />
          </Field>

          <Field label="Next action date">
            <Input
              type="date"
              value={form.next_action_date}
              onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
            />
          </Field>

          <Field label="Next action">
            <Input
              value={form.next_action_note}
              onChange={(e) => setForm({ ...form, next_action_note: e.target.value })}
              placeholder="Call back about flights"
            />
          </Field>

          <Field label="Travelling with" className="sm:col-span-2">
            <Input
              value={form.companions}
              onChange={(e) => setForm({ ...form, companions: e.target.value })}
              placeholder="Names of companions"
            />
          </Field>

          {stageIsLost && (
            <>
              <Field label="Lost reason">
                <Select value={form.lost_reason} onValueChange={(v) => setForm({ ...form, lost_reason: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not recorded</SelectItem>
                    {(config?.lostReasons || []).map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Lost notes">
                <Input
                  value={form.lost_notes}
                  onChange={(e) => setForm({ ...form, lost_notes: e.target.value })}
                />
              </Field>
            </>
          )}

          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {lead ? "Save changes" : "Create enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
