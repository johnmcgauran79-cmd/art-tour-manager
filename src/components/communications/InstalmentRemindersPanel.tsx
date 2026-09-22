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
import {
  Loader2, Send, Clock, Ban, RotateCcw, RefreshCw, CircleDollarSign, AlertTriangle, Phone, PauseCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  InstalmentReminder,
  ReminderKind,
  useInstalmentReminderAction,
  useInstalmentReminders,
  useRefreshInstalmentReminders,
} from "@/hooks/useInstalmentReminders";
import { usePermissions } from "@/hooks/usePermissions";

const money = (n: number | null | undefined, ccy = "AUD") =>
  `${ccy} ${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateAU = (v: string | null) => (v ? format(new Date(v), "dd/MM/yyyy") : "—");

const STATE_LABELS: Record<string, string> = {
  pending: "Awaiting first email",
  sent: "Chasing automatically",
  held_agent: "Agent invoice — check",
  needs_call: "Needs a phone call",
  stopped: "Stopped",
};

const KIND_COPY: Record<ReminderKind, { title: string; blurb: string; empty: string }> = {
  instalment: {
    title: "Instalment payments",
    blurb:
      "One line per invoice, built each night from live Xero figures. Send the first email yourself; after that unpaid invoices are chased automatically every fortnight, and flagged for a phone call after three emails.",
    empty:
      "Nothing owing. Lines appear here once a tour's instalment date has passed and Xero still shows the instalment unpaid.",
  },
  final: {
    title: "Final balances",
    blurb:
      "Full invoices — every line item, invoice number, bank details, card link and the cancellation policy. Send the first one yourself; unpaid invoices are then chased automatically each week, and flagged for a phone call after three emails.",
    empty:
      "Nothing owing. Lines appear here once a tour's final payment date has passed and Xero still shows a balance.",
  },
};

const KIND_ORDER: ReminderKind[] = ["instalment", "final"];

export const InstalmentRemindersPanel = () => {
  const { hasEditAccess } = usePermissions();
  const canAct = hasEditAccess;
  const { data: rows = [], isLoading } = useInstalmentReminders();
  const action = useInstalmentReminderAction();
  const refresh = useRefreshInstalmentReminders();
  const [kind, setKind] = useState<ReminderKind>("instalment");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState("");

  const byKind = useMemo(() => {
    const map: Record<ReminderKind, InstalmentReminder[]> = { instalment: [], final: [] };
    for (const r of rows) map[(r.kind as ReminderKind) ?? "instalment"]?.push(r);
    return map;
  }, [rows]);

  const kindRows = byKind[kind] ?? [];

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: InstalmentReminder[] }>();
    for (const r of kindRows) {
      const entry = map.get(r.tour_id) ?? { name: r.tour?.name || "Unknown tour", rows: [] };
      entry.rows.push(r);
      map.set(r.tour_id, entry);
    }
    return Array.from(map.values());
  }, [kindRows]);

  const selectable = kindRows;
  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const needsAction = kindRows.filter((r) =>
    r.state === "pending" || r.state === "held_agent" || r.state === "needs_call").length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const run = async (a: "send" | "skip" | "stop" | "resume" | "pause_auto", reason?: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await action.mutateAsync({ ids, action: a, reason });
    setSelected(new Set());
    setStopReason("");
    setStopOpen(false);
  };

  const busy = action.isPending || refresh.isPending;
  const copy = KIND_COPY[kind];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-4 w-4" />
              Payment reminders
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>{copy.blurb}</CardDescription>
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
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => run("pause_auto")}>
                  <PauseCircle className="h-4 w-4 mr-1" /> Pause auto
                </Button>
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => run("resume")}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Resume
                </Button>
                <Button size="sm" variant="destructive" disabled={busy || selected.size === 0} onClick={() => setStopOpen(true)}>
                  <Ban className="h-4 w-4 mr-1" /> Stop ({selected.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || test.isPending || selected.size !== 1 || !myEmail}
                  title={myEmail ? `Send a test copy to ${myEmail}` : "No email on your account"}
                  onClick={() => {
                    const id = Array.from(selected)[0];
                    if (id && myEmail) test.mutate({ id, email: myEmail });
                  }}
                >
                  {test.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                  Send test to me
                </Button>
                <Button size="sm" disabled={busy || selected.size === 0} onClick={() => run("send")}>
                  {action.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Send now ({selected.size})
                </Button>

              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setSelected(new Set()); }}
              className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors ${
                kind === k ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {KIND_COPY[k].title}
              <Badge variant="secondary">{(byKind[k] ?? []).length}</Badge>
            </button>
          ))}
        </div>


        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reminders…
          </div>
        ) : kindRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{copy.empty}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                Select all ({selectable.length})
              </span>
              {needsAction > 0 && <span>{needsAction} need you to act</span>}
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
                          <span>Final payment {dateAU(r.final_payment_date ?? r.tour?.final_payment_date ?? null)}</span>
                          <span>Emails sent: {r.reminder_count}</span>
                          {r.last_sent_at && <span>Last {dateAU(r.last_sent_at)}</span>}
                          <span>Next {dateAU(r.next_due_at)}</span>
                          {r.auto_send === false && r.state !== "stopped" && (
                            <Badge variant="outline">Automatic sending paused</Badge>
                          )}
                          <Badge
                            variant={
                              r.state === "held_agent" || r.state === "needs_call"
                                ? "destructive"
                                : r.state === "stopped"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {STATE_LABELS[r.state] ?? r.state}
                          </Badge>
                        </div>
                        {(r.state === "held_agent" || r.state === "needs_call") && r.hold_reason && (
                          <div className="flex items-start gap-1.5 text-xs text-destructive">
                            {r.state === "needs_call"
                              ? <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
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
