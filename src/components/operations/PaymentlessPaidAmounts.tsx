import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  booking_id: string | null;
  xero_invoice_number: string | null;
  amount_paid: number | null;
  total_amount: number | null;
  amount_due: number | null;
  currency_code: string | null;
  updated_at: string;
  booking?: {
    id: string;
    tour?: { name: string | null } | null;
    customer?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
}

const formatMoney = (n: number | null | undefined, ccy = "AUD") =>
  `${ccy} ${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PaymentlessPaidAmounts = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["paymentless-paid-amounts"],
    queryFn: async (): Promise<Row[]> => {
      // Bookings where Xero shows amount_paid > 0 but no Payment record
      // (last_payment_date is NULL) — likely credit note / prepayment /
      // overpayment allocations that our receipt sync can't build from.
      const { data: mappings, error } = await supabase
        .from("xero_invoice_mappings")
        .select(`
          id, booking_id, xero_invoice_number, amount_paid, total_amount, amount_due,
          currency_code, updated_at,
          booking:bookings!xero_invoice_mappings_booking_id_fkey (
            id,
            tour:tours ( name ),
            customer:customers!bookings_lead_passenger_id_fkey ( first_name, last_name, email )
          )
        `)
        .gt("amount_paid", 0)
        .is("last_payment_date", null)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (mappings as any as Row[]) || [];

      // Filter out any bookings that already have a receipt tracked
      const bookingIds = list.map((r) => r.booking_id).filter(Boolean) as string[];
      if (bookingIds.length === 0) return list;
      const { data: receipts } = await supabase
        .from("xero_payment_receipts")
        .select("booking_id, approval_status")
        .in("booking_id", bookingIds)
        .in("approval_status", ["pending", "approved", "sent"]);
      const covered = new Set((receipts || []).map((r: any) => r.booking_id));
      return list.filter((r) => !r.booking_id || !covered.has(r.booking_id));
    },
    refetchOnWindowFocus: false,
  });

  if (isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Payment-less Paid Amounts
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>
              Xero shows an amount paid on these invoices but no Payment record — usually a credit
              note, prepayment or overpayment allocation. Automatic receipts can&apos;t be generated
              until a real Payment is recorded in Xero.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <div className="hidden md:grid grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] gap-3 items-center px-3 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            <div>Customer</div>
            <div>Tour · Invoice</div>
            <div>Paid</div>
            <div>Balance</div>
            <div>Last update</div>
          </div>
          <div className="divide-y max-h-[420px] overflow-y-auto">
            {rows.map((r) => {
              const name = [r.booking?.customer?.first_name, r.booking?.customer?.last_name].filter(Boolean).join(" ") || "Unknown";
              const email = r.booking?.customer?.email || "—";
              const tourName = r.booking?.tour?.name || "—";
              const ccy = r.currency_code || "AUD";
              return (
                <div
                  key={r.id}
                  className="block md:grid md:grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] md:gap-3 md:items-center px-3 py-3 md:py-2 text-sm hover:bg-muted/30"
                >
                  {/* Mobile layout */}
                  <div className="md:hidden space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      {r.booking_id ? (
                        <Link to={`/bookings/${r.booking_id}`} className="truncate font-medium text-primary hover:underline inline-flex items-center gap-1 min-w-0">
                          <span className="truncate">{name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      ) : (
                        <div className="truncate font-medium">{name}</div>
                      )}
                      <div className="font-semibold whitespace-nowrap">{formatMoney(r.amount_paid, ccy)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{email}</div>
                    <div className="text-xs text-muted-foreground truncate">{tourName}</div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Inv {r.xero_invoice_number || "—"}</span>
                      <span>Bal {formatMoney(r.amount_due, ccy)}</span>
                      <span>{r.updated_at ? format(new Date(r.updated_at), "dd/MM/yyyy") : "—"}</span>
                    </div>
                  </div>
                  {/* Desktop layout */}
                  <div className="hidden md:block min-w-0">
                    {r.booking_id ? (
                      <Link
                        to={`/bookings/${r.booking_id}`}
                        className="truncate font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {name}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                    ) : (
                      <div className="truncate font-medium">{name}</div>
                    )}
                    <div className="truncate text-xs text-muted-foreground">{email}</div>
                  </div>
                  <div className="hidden md:block min-w-0">
                    <div className="truncate">{tourName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Invoice {r.xero_invoice_number || "—"}
                    </div>
                  </div>
                  <div className="hidden md:block font-medium">{formatMoney(r.amount_paid, ccy)}</div>
                  <div className="hidden md:block">{formatMoney(r.amount_due, ccy)}</div>
                  <div className="hidden md:block text-xs text-muted-foreground">
                    {r.updated_at ? format(new Date(r.updated_at), "dd/MM/yyyy") : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};