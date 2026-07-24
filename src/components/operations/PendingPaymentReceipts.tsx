import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Check, X, Receipt } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PendingReceiptRow {
  id: string;
  booking_id: string | null;
  xero_invoice_number: string | null;
  amount: number;
  currency_code: string | null;
  payment_date: string | null;
  invoice_amount_due: number | null;
  recipient_email: string | null;
  created_at: string;
  booking?: {
    id: string;
    tour_id: string | null;
    tour?: { id: string; name: string | null } | null;
    customer?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
}

const formatMoney = (n: number | null | undefined, ccy = "AUD") =>
  `${ccy} ${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PendingPaymentReceipts = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending-payment-receipts"],
    queryFn: async (): Promise<PendingReceiptRow[]> => {
      const { data, error } = await supabase
        .from("xero_payment_receipts")
        .select(`
          id, booking_id, xero_invoice_number, amount, currency_code, payment_date,
          invoice_amount_due, recipient_email, created_at,
          booking:bookings!xero_payment_receipts_booking_id_fkey (
            id, tour_id,
            tour:tours ( id, name ),
            customer:customers!bookings_lead_passenger_id_fkey ( first_name, last_name, email )
          )
        `)
        .eq("approval_status", "pending")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
    refetchOnWindowFocus: false,
  });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invokeAction = async (action: "approve" | "reject", reason?: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("send-approved-payment-receipts", {
        body: {
          receipt_ids: ids,
          action,
          rejection_reason: reason || null,
          approver_id: userRes?.user?.id || null,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error((data as any)?.error || "Action failed");

      if (action === "approve") {
        toast({
          title: "Receipts approved",
          description: `${data.sent} sent · ${data.errors} error(s)`,
          variant: data.errors > 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Receipts rejected",
          description: `${data.rejected} receipt(s) rejected`,
        });
      }
      setSelected(new Set());
      setRejectReason("");
      setRejectOpen(false);
      qc.invalidateQueries({ queryKey: ["pending-payment-receipts"] });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const totalPending = rows.length;

  if (!isLoading && totalPending === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              Pending Payment Receipts
              <Badge variant="secondary">{totalPending}</Badge>
            </CardTitle>
            <CardDescription>
              Payment confirmation emails waiting for approval before being sent to customers.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || selected.size === 0}
              onClick={() => setRejectOpen(true)}
            >
              <X className="h-4 w-4 mr-1" /> Reject ({selected.size})
            </Button>
            <Button
              size="sm"
              disabled={busy || selected.size === 0}
              onClick={() => invokeAction("approve")}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Approve &amp; Send ({selected.size})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pending receipts…
          </div>
        ) : (
          <div className="border rounded-md">
            {/* Header row — desktop/tablet only */}
            <div className="hidden md:grid grid-cols-[auto_1.2fr_1.6fr_1fr_1fr_1fr] gap-3 items-center px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={allSelected}
                data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <div>Customer</div>
              <div>Tour · Invoice</div>
              <div>Payment</div>
              <div>Balance</div>
              <div>Payment date</div>
            </div>
            {/* Mobile select-all */}
            <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={allSelected}
                data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <span>Select all ({rows.length})</span>
            </div>
            <div className="divide-y max-h-[420px] overflow-y-auto">
              {rows.map((r) => {
                const name = [r.booking?.customer?.first_name, r.booking?.customer?.last_name].filter(Boolean).join(" ") || "Unknown";
                const email = r.recipient_email || r.booking?.customer?.email || "—";
                const tourName = r.booking?.tour?.name || "—";
                const ccy = r.currency_code || "AUD";
                return (
                  <label
                    key={r.id}
                    className="block md:grid md:grid-cols-[auto_1.2fr_1.6fr_1fr_1fr_1fr] md:gap-3 md:items-center px-3 py-3 md:py-2 text-sm hover:bg-muted/30 cursor-pointer"
                  >
                    {/* Mobile layout */}
                    <div className="md:hidden flex items-start gap-3">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label={`Select receipt ${r.xero_invoice_number}`}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{name}</div>
                            <div className="truncate text-xs text-muted-foreground">{email}</div>
                          </div>
                          <div className="font-semibold whitespace-nowrap">{formatMoney(r.amount, ccy)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{tourName}</div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Inv {r.xero_invoice_number || "—"}</span>
                          <span>Bal {formatMoney(r.invoice_amount_due, ccy)}</span>
                          <span>{r.payment_date ? format(new Date(r.payment_date), "dd/MM/yyyy") : "—"}</span>
                        </div>
                      </div>
                    </div>
                    {/* Desktop/tablet layout */}
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select receipt ${r.xero_invoice_number}`}
                      className="hidden md:inline-flex"
                    />
                    <div className="hidden md:block min-w-0">
                      <div className="truncate font-medium">{name}</div>
                      <div className="truncate text-xs text-muted-foreground">{email}</div>
                    </div>
                    <div className="hidden md:block min-w-0">
                      <div className="truncate">{tourName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        Invoice {r.xero_invoice_number || "—"}
                      </div>
                    </div>
                    <div className="hidden md:block font-medium">{formatMoney(r.amount, ccy)}</div>
                    <div className="hidden md:block">{formatMoney(r.invoice_amount_due, ccy)}</div>
                    <div className="hidden md:block">{r.payment_date ? format(new Date(r.payment_date), "dd/MM/yyyy") : "—"}</div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {selected.size} receipt(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Rejected receipts won&apos;t email the customer. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optional reason (internal note)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                invokeAction("reject", rejectReason);
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};