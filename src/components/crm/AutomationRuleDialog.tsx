import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useCrmConfig } from "@/hooks/useCrm";
import { LEAD_PRIORITIES } from "@/lib/crm/constants";
import { useSaveAutomationRule, type AutomationRule } from "@/hooks/useCrmSales";

export const TRIGGERS = [
  { value: "no_next_action", label: "An active enquiry has nothing planned" },
  { value: "stale_lead", label: "An enquiry is going cold" },
  { value: "overdue_next_action", label: "A follow-up date has passed" },
  { value: "awaiting_first_response", label: "Nobody has responded yet" },
  { value: "nurture_review_due", label: "A nurture enquiry is due for review" },
  { value: "new_lead_unassigned", label: "A new enquiry has nobody looking after it" },
  { value: "marketing_signal", label: "Someone clicked an enquiry or booking link in an email" },
] as const;

const ACTIONS = [
  { value: "create_task", label: "Raise a task in the Task Manager" },
  { value: "notify_staff", label: "Notify someone in the app" },
  { value: "notify_teams", label: "Post a Teams message" },
  { value: "set_priority", label: "Change the priority" },
  { value: "assign_owner", label: "Give it to someone" },
  { value: "move_stage", label: "Move it to another stage" },
  { value: "add_tag", label: "Add a tag to the contact" },
] as const;

const NONE = "__none__";

export const describeActions = (actions: any[]) =>
  (actions || [])
    .map((a) => ACTIONS.find((x) => x.value === a.type)?.label || a.type)
    .join(", ") || "Nothing yet";

export function AutomationRuleDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule?: AutomationRule | null;
}) {
  const save = useSaveAutomationRule();
  const { data: config } = useCrmConfig();
  const { data: users = [] } = useAssignableUsers();

  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
    trigger_type: "no_next_action",
    cooldown_days: 3,
    min_age_days: "",
    min_days_in_stage: "",
    stages: [] as string[],
    priorities: [] as string[],
    only_unassigned: false,
    actions: [] as any[],
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: rule?.name || "",
      description: rule?.description || "",
      is_active: rule?.is_active ?? true,
      trigger_type: rule?.trigger_type || "no_next_action",
      cooldown_days: rule?.cooldown_days ?? 3,
      min_age_days: rule?.conditions?.min_age_days?.toString() || "",
      min_days_in_stage: rule?.conditions?.min_days_in_stage?.toString() || "",
      stages: rule?.conditions?.stages || [],
      priorities: rule?.conditions?.priorities || [],
      only_unassigned: !!rule?.conditions?.only_unassigned,
      actions: rule?.actions?.length
        ? rule.actions
        : [{ type: "create_task", title: "Follow up {{contact}} about {{tour}}", due_in_days: 0, priority: "high" }],
    });
  }, [open, rule]);

  const setAction = (i: number, patch: any) =>
    setForm((f) => ({ ...f, actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  const submit = async () => {
    await save.mutateAsync({
      id: rule?.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
      trigger_type: form.trigger_type,
      cooldown_days: Number(form.cooldown_days) || 0,
      conditions: {
        stages: form.stages,
        priorities: form.priorities,
        only_unassigned: form.only_unassigned,
        ...(form.min_age_days ? { min_age_days: Number(form.min_age_days) } : {}),
        ...(form.min_days_in_stage ? { min_days_in_stage: Number(form.min_days_in_stage) } : {}),
      },
      actions: form.actions,
      scope: {},
    } as any);
    onOpenChange(false);
  };

  const toggle = (key: "stages" | "priorities", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            Choose what to watch for, narrow it down if you want, then say what should happen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note for the team (optional)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Watch for</Label>
              <Select
                value={form.trigger_type}
                onValueChange={(v) => setForm({ ...form, trigger_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Don't repeat within (days)</Label>
              <Input
                type="number"
                min={0}
                value={form.cooldown_days}
                onChange={(e) => setForm({ ...form, cooldown_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Only if at least this old (days, optional)</Label>
              <Input
                type="number"
                min={0}
                value={form.min_age_days}
                onChange={(e) => setForm({ ...form, min_age_days: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Only after this long in the stage (work days, optional)</Label>
              <Input
                type="number"
                min={0}
                value={form.min_days_in_stage}
                onChange={(e) => setForm({ ...form, min_days_in_stage: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Only these stages (leave empty for all)</Label>
            <div className="flex flex-wrap gap-1.5">
              {(config?.stages || []).map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  size="sm"
                  variant={form.stages.includes(s.key) ? "default" : "outline"}
                  onClick={() => toggle("stages", s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Only these priorities (leave empty for all)</Label>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_PRIORITIES.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={form.priorities.includes(p.value) ? "default" : "outline"}
                  onClick={() => toggle("priorities", p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="font-normal">Only enquiries with nobody looking after them</Label>
            <Switch
              checked={form.only_unassigned}
              onCheckedChange={(v) => setForm({ ...form, only_unassigned: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>What should happen</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({ ...f, actions: [...f.actions, { type: "notify_teams", message: "" }] }))
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

            {form.actions.map((a, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Select value={a.type} onValueChange={(v) => setAction(i, { type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((x) => (
                        <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {a.type === "create_task" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Task title"
                      value={a.title || ""}
                      onChange={(e) => setAction(i, { title: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Due in days"
                      value={a.due_in_days ?? 0}
                      onChange={(e) => setAction(i, { due_in_days: Number(e.target.value) })}
                    />
                    <Select
                      value={a.priority || "high"}
                      onValueChange={(v) => setAction(i, { priority: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Task priority" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={a.assignee_id || NONE}
                      onValueChange={(v) => setAction(i, { assignee_id: v === NONE ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Give it to the owner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Whoever owns the enquiry</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(a.type === "notify_teams" || a.type === "notify_staff") && (
                  <Textarea
                    rows={2}
                    placeholder="Message — you can use {{contact}}, {{tour}}, {{stage}} and {{days}}"
                    value={a.message || ""}
                    onChange={(e) => setAction(i, { message: e.target.value })}
                  />
                )}

                {a.type === "set_priority" && (
                  <Select value={a.priority || "high"} onValueChange={(v) => setAction(i, { priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {a.type === "assign_owner" && (
                  <Select value={a.owner_id || NONE} onValueChange={(v) => setAction(i, { owner_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Who" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {a.type === "move_stage" && (
                  <Select value={a.stage || ""} onValueChange={(v) => setAction(i, { stage: v })}>
                    <SelectTrigger><SelectValue placeholder="Move to" /></SelectTrigger>
                    <SelectContent>
                      {(config?.stages || []).map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {a.type === "add_tag" && (
                  <Input
                    placeholder="Tag name"
                    value={a.tag || ""}
                    onChange={(e) => setAction(i, { tag: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="font-normal">Switched on</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim() || save.isPending}>
            Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
