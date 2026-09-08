import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Play, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import {
  useAutomationRules,
  useAutomationRuns,
  useDeleteAutomationRule,
  useRunAutomation,
  useSaveAutomationRule,
  type AutomationRule,
} from "@/hooks/useCrmSales";
import { AutomationRuleDialog, TRIGGERS, describeActions } from "./AutomationRuleDialog";

/** Admin view of the sales chasers: what they watch for and what they've done. */
export function CrmAutomationTab() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: runs = [] } = useAutomationRuns();
  const save = useSaveAutomationRule();
  const remove = useDeleteAutomationRule();
  const run = useRunAutomation();

  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Automatic chasing</CardTitle>
              <CardDescription>
                These watch the pipeline and act when an enquiry is being neglected — always through the
                existing Task Manager and Teams messages, never by emailing clients on your behalf.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => run.mutate({ preview: true })}
                disabled={run.isPending}
              >
                Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => run.mutate({})} disabled={run.isPending}>
                <Play className="mr-1 h-4 w-4" /> Run now
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-1 h-4 w-4" /> New rule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>On</TableHead>
                <TableHead>Watches for</TableHead>
                <TableHead>Does</TableHead>
                <TableHead className="text-right">Last run</TableHead>
                <TableHead className="text-right">Actions taken</TableHead>
                <TableHead className="text-right">Problems</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setEditing(r)}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.description && (
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => save.mutate({ id: r.id, is_active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {TRIGGERS.find((t) => t.value === r.trigger_type)?.label || r.trigger_type}
                  </TableCell>
                  <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                    {describeActions(r.actions)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {r.last_run_at ? formatDateToDDMMYYYY(r.last_run_at) : "Never"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{r.action_count}</TableCell>
                  <TableCell className="text-right">
                    {r.failure_count > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {r.failure_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remove "${r.name}"?`)) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rules.length && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No automatic chasing set up yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Every action taken, and anything that failed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {runs.slice(0, 30).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
              <span className="truncate">
                {rules.find((x) => x.id === r.rule_id)?.name || "Removed rule"}
                {r.lead_id && (
                  <>
                    {" — "}
                    <Link to={`/leads/${r.lead_id}`} className="hover:underline">
                      enquiry
                    </Link>
                  </>
                )}
                {r.error_message && (
                  <span className="text-destructive"> — {r.error_message}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDateToDDMMYYYY(r.created_at)}
                {Array.isArray(r.actions_taken) && r.actions_taken.length
                  ? ` · ${r.actions_taken.join(", ")}`
                  : ""}
              </span>
            </div>
          ))}
          {!runs.length && <p className="text-muted-foreground">Nothing has run yet.</p>}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <AutomationRuleDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreating(false);
              setEditing(null);
            }
          }}
          rule={editing}
        />
      )}
    </div>
  );
}
