import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Send, Clock, Ban, RotateCcw, RefreshCw, CircleDollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import {
  InstalmentReminder,
  useInstalmentReminderAction,
  useInstalmentReminders,
  useRefreshInstalmentReminders,
} from "@/hooks/useInstalmentReminders";
import { usePermissions } from "@/hooks/usePermissions";

const money = (n: number | null | undefined, ccy = "AUD") =>
  `${ccy} ${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateAU = (v: string | null) => (v ? format(new Date(v), "dd/MM/yyyy") : "—");

const STATE_LABELS: Record<string, string> = {
  pending: "Due",
  sent: "Reminded",
  held_agent: "Agent invoice — check",
  stopped: "Stopped",
};

export const InstalmentRemindersPanel = () => {
  const { hasEditAccess } = usePermissions();
  const canAct = hasEditAccess;
  const { data: rows = [], isLoading } = useInstalmentReminders();
  const action = useInstalmentReminderAction();
  const refresh = useRefreshInstalmentReminders();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: InstalmentReminder[] }>();
    for (const r of rows) {
      const key = r.tour_id;
      const entry = map.get(key) ?? { name: r.tour?.name || "Unknown tour", rows: [] };
      entry.rows.push(r);
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [rows]);

  const selectable = rows.filter((r) => r.state !== "stopped");
  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const run = async (a: "send" | "skip" | "stop" | "resume", reason?: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await action.mutateAsync({ ids, action: a, reason });
    setSelected(new Set());
    setStopReason("");
    setStopOpen(false);
  };

  const busy = action.isPending || refresh.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-4 w-4" />
              Instalment reminders
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>
              One reminder per invoice, built from live Xero figures. Approve to send, push back a week, or stop
              reminders when a payment plan has been agreed. Unpaid invoices come back weekly.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => refresh.mutate()}>
              {refresh.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Check Xero now
            </Button>
            {canAct && (
              <>
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => run("skip")}>
                  <Clock className="h-4 w-4 mr-1" /> Skip a week
                </Button>
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => run("resume")}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Resume
                </Button>
                <Button size="sm" variant="destructive" disabled={busy || selected.size === 0} onClick={() => setStopOpen(true)}>
                  <Ban className="h-4 w-4 mr-1" /> Stop ({selected.size})
                </Button>
                <Button size="sm" disabled={busy || selected.size === 0} onClick={() => run("send")}>
                  {action.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Approve &amp; send ({selected.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reminders…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nothing owing. Reminders appear here once a tour's instalment date has passed and Xero still shows the
            instalment unpaid.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              <span>Select all ({selectable.length})</span>
            </div>

            {groups.map((g) => (
              <div key={g.name} className="border rounded-md">
                <div className="px-3 py-2 border-b bg-muted/40 text-sm font-medium">{g.name}</div>
                <div className="divide-y">
                  {g.rows.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-start gap-3 px-3 py-3 text-sm hover:bg-muted/30 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        disabled={r.state === "stopped" ? false : false}
                        aria-label={`Select invoice ${r.xero_invoice_number ?? ""}`}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {r.recipient_name || "Unknown"}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                Inv {r.xero_invoice_number || "—"} · {r.pax_count} pax
                              </span>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.recipient_email || "no email on file"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold whitespace-nowrap">{money(r.shortfall, r.currency_code)}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              due now · balance {money(r.amount_due, r.currency_code)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Invoice {money(r.invoice_total, r.currency_code)}</span>
                          <span>Paid {money(r.amount_paid, r.currency_code)}</span>
                          <span>Final payment {dateAU(r.tour?.final_payment_date ?? null)}</span>
                          <span>Reminders sent: {r.reminder_count}</span>
                          {r.last_sent_at && <span>Last {dateAU(r.last_sent_at)}</span>}
                          <span>Next {dateAU(r.next_due_at)}</span>
                          <Badge variant={r.state === "held_agent" ? "destructive" : r.state === "stopped" ? "outline" : "secondary"}>
                            {STATE_LABELS[r.state] ?? r.state}
                          </Badge>
                        </div>
                        {r.state === "held_agent" && r.hold_reason && (
                          <div className="flex items-start gap-1.5 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{r.hold_reason}</span>
                          </div>
                        )}
                        {r.state === "stopped" && r.stop_reason && (
                          <div className="text-xs text-muted-foreground">Stopped: {r.stop_reason}</div>
                        )}
                        {r.send_error && (
                          <div className="text-xs text-destructive">Last send failed: {r.send_error}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>

      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop reminders for {selected.size} invoice(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              No further reminders will be sent for these invoices. Add a short note so the team knows why — for
              example, a payment plan agreed directly with the client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={stopReason}
            onChange={(e) => setStopReason(e.target.value)}
            placeholder="Payment plan agreed — paying $500 monthly"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("stop", stopReason)}>Stop reminders</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
