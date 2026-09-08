import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCrmSettings,
  useStageSettings,
  useUpdateCrmSettings,
  useUpdateStageSetting,
} from "@/hooks/useCrmSales";

/** How the sales safeguards behave: response target, escalation and per-stage patience. */
export function CrmSalesSettings() {
  const { data: settings } = useCrmSettings();
  const { data: stages = [] } = useStageSettings();
  const saveSettings = useUpdateCrmSettings();
  const saveStage = useUpdateStageSetting();

  const [form, setForm] = useState({
    first_response_target_hours: 4,
    owner_warning_days: 2,
    manager_escalation_days: 5,
    crm_era_start: "",
  });

  useEffect(() => {
    if (settings)
      setForm({
        first_response_target_hours: settings.first_response_target_hours,
        owner_warning_days: settings.owner_warning_days,
        manager_escalation_days: settings.manager_escalation_days,
        crm_era_start: settings.crm_era_start,
      });
  }, [settings]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales standards</CardTitle>
          <CardDescription>
            These decide when the system says an enquiry is being neglected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First response target (business hours)</Label>
            <Input
              type="number"
              min={1}
              value={form.first_response_target_hours}
              onChange={(e) =>
                setForm({ ...form, first_response_target_hours: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Warn the owner after (days overdue)</Label>
            <Input
              type="number"
              min={0}
              value={form.owner_warning_days}
              onChange={(e) => setForm({ ...form, owner_warning_days: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Escalate to a manager after (days overdue)</Label>
            <Input
              type="number"
              min={0}
              value={form.manager_escalation_days}
              onChange={(e) => setForm({ ...form, manager_escalation_days: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Enquiry records start from</Label>
            <Input
              type="date"
              value={form.crm_era_start}
              onChange={(e) => setForm({ ...form, crm_era_start: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Reports won't claim conversion rates for anything before this date.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending}>
              Save standards
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stages</CardTitle>
          <CardDescription>
            How long an enquiry may sit in each stage before it counts as going cold, and which stages
            are chased at all.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-center">Counts as active</TableHead>
                <TableHead className="text-center">Needs a next action</TableHead>
                <TableHead className="text-center">Never chased</TableHead>
                <TableHead className="w-32 text-right">Cold after (work days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.counts_as_active}
                      onCheckedChange={(v) => saveStage.mutate({ id: s.id, counts_as_active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.requires_next_action}
                      onCheckedChange={(v) => saveStage.mutate({ id: s.id, requires_next_action: v })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.exempt_from_followup}
                      onCheckedChange={(v) => saveStage.mutate({ id: s.id, exempt_from_followup: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      className="ml-auto w-20 text-right"
                      defaultValue={s.stale_after_days ?? ""}
                      onBlur={(e) =>
                        saveStage.mutate({
                          id: s.id,
                          stale_after_days: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
