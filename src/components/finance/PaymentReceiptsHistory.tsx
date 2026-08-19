import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Receipt, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Link } from "react-router-dom";

type Scope =
  | { bookingId: string; customerId?: never }
  | { customerId: string; bookingId?: never };

type Row = {
  id: string;
  amount: number;
  currency_code: string | null;
  payment_date: string | null;
  xero_invoice_number: string | null;
  receipt_email_sent_at: string | null;
  send_error: string | null;
  skipped_reason: string | null;
  recipient_email: string | null;
  booking_id: string | null;
  invoice_amount_due: number | null;
  invoice_total: number | null;
  booking?: {
    id: string;
    tour_id: string | null;
    tours?: { id: string; name: string | null } | null;
  } | null;
};

function formatAmount(amount: number, currency: string | null) {
  const c = currency || "AUD";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: c }).format(amount);
  } catch {
    return `${c} ${amount.toFixed(2)}`;
  }
}

export function PaymentReceiptsHistory(props: Scope & { title?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { canPerformAction } = usePermissions();
  const canResend = canPerformAction("booking", "edit").allowed;
  const [resendTarget, setResendTarget] = useState<Row | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleResend = async () => {
    if (!resendTarget) return;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const { data, error: fnErr } = await supabase.functions.invoke(
        "send-approved-payment-receipts",
        {
          body: {
            receipt_ids: [resendTarget.id],
            action: "approve",
            resend: true,
            approver_id: sessionData?.user?.id ?? null,
            override_recipient_email:
              resendEmail && resendEmail !== resendTarget.recipient_email ? resendEmail : undefined,
          },
        }
      );
      if (fnErr) throw fnErr;
      if ((data as any)?.sent > 0) {
        toast.success(`Receipt resent to ${resendEmail || resendTarget.recipient_email}`);
      } else {
        toast.error("Receipt could not be resent — check the recipient email and try again.");
      }
      setResendTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resend receipt");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRows(null);
      setError(null);

      let bookingIds: string[] | null = null;
      if ("customerId" in props && props.customerId) {
        const { data: bookings, error: bErr } = await supabase
          .from("bookings")
          .select("id")
          .or(
            `lead_passenger_id.eq.${props.customerId},passenger_2_id.eq.${props.customerId},passenger_3_id.eq.${props.customerId}`
          );
        if (bErr) {
          if (!cancelled) setError(bErr.message);
          return;
        }
        bookingIds = (bookings ?? []).map((b) => b.id);
        if (bookingIds.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }
      }

      let query = supabase
        .from("xero_payment_receipts")
        .select(
          "id, amount, currency_code, payment_date, xero_invoice_number, receipt_email_sent_at, send_error, skipped_reason, recipient_email, booking_id, invoice_amount_due, invoice_total, booking:bookings(id, tour_id, tours(id, name))"
        )
        .order("payment_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if ("bookingId" in props && props.bookingId) {
        query = query.eq("booking_id", props.bookingId);
      } else if (bookingIds) {
        query = query.in("booking_id", bookingIds);
      }

      const { data, error: rErr } = await query;
      if (cancelled) return;
      if (rErr) {
        setError(rErr.message);
        return;
      }
      setRows((data ?? []) as unknown as Row[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [(props as any).bookingId, (props as any).customerId, reloadKey]);

  const isContactScope = "customerId" in props;

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{props.title ?? "Payment Receipts"}</h3>
      </div>

      {rows === null && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipts…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No payment receipts recorded yet. Receipts are generated automatically when Xero payments sync.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="text-left font-medium py-2 px-2">Date</th>
                <th className="text-left font-medium py-2 px-2">Amount</th>
                <th className="text-left font-medium py-2 px-2">Invoice</th>
                {isContactScope && (
                  <th className="text-left font-medium py-2 px-2">Tour</th>
                )}
                <th className="text-left font-medium py-2 px-2">Balance</th>
                <th className="text-left font-medium py-2 px-2">Receipt Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tour = r.booking?.tours;
                return (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.payment_date ? formatDateToDDMMYYYY(r.payment_date) : "—"}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap font-medium">
                      {formatAmount(r.amount, r.currency_code)}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.xero_invoice_number || "—"}
                    </td>
                    {isContactScope && (
                      <td className="py-2 px-2">
                        {tour?.id ? (
                          <Link
                            to={`/tours/${tour.id}`}
                            className="text-primary hover:underline"
                          >
                            {tour.name || "Tour"}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {r.booking?.id && (
                          <div className="text-xs text-muted-foreground">
                            <Link
                              to={`/bookings/${r.booking.id}`}
                              className="hover:underline"
                            >
                              View booking
                            </Link>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.invoice_amount_due != null
                        ? formatAmount(r.invoice_amount_due, r.currency_code)
                        : "—"}
                    </td>
                    <td className="py-2 px-2">
                      {r.receipt_email_sent_at ? (
                        <Badge variant="secondary">
                          Sent {formatDateToDDMMYYYY(r.receipt_email_sent_at)}
                        </Badge>
                      ) : r.skipped_reason ? (
                        <Badge variant="outline" title={r.skipped_reason}>
                          Skipped
                        </Badge>
                      ) : r.send_error ? (
                        <Badge variant="destructive" title={r.send_error}>
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {r.recipient_email && r.receipt_email_sent_at && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.recipient_email}
                        </div>
                      )}
                      {canResend && (
                        <div className="mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setResendTarget(r);
                              setResendEmail(r.recipient_email || "");
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {r.receipt_email_sent_at ? "Resend" : "Send receipt"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!resendTarget} onOpenChange={(o) => !o && setResendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send payment receipt</AlertDialogTitle>
            <AlertDialogDescription>
              {resendTarget && (
                <>
                  Receipt for {formatAmount(resendTarget.amount, resendTarget.currency_code)}
                  {resendTarget.payment_date
                    ? ` paid on ${formatDateToDDMMYYYY(resendTarget.payment_date)}`
                    : ""}
                  {resendTarget.xero_invoice_number ? ` (${resendTarget.xero_invoice_number})` : ""}.
                  {resendTarget.receipt_email_sent_at
                    ? " This receipt was already emailed — sending again will deliver a duplicate."
                    : ""}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Send to</label>
            <Input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResend();
              }}
              disabled={sending || !resendEmail.includes("@")}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
                </>
              ) : (
                "Send receipt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PaymentReceiptsHistory;