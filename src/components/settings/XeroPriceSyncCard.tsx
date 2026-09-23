import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface XeroPriceRow {
  tour_id: string;
  tour_name: string;
  start_date: string;
  code: string | null;
  art_price: number | null;
  xero_price: number | null;
  xero_item_name: string | null;
  state: string;
}

const STATE_LABEL: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  mismatch: { text: "Will be updated", variant: "destructive" },
  match: { text: "Matches", variant: "secondary" },
  updated: { text: "Updated", variant: "default" },
  no_code: { text: "No Xero product code", variant: "outline" },
  code_not_in_xero: { text: "Code not found in Xero", variant: "outline" },
  no_art_price: { text: "No twin/double price", variant: "outline" },
  failed: { text: "Update failed", variant: "destructive" },
  no_permission: { text: "Reconnect Xero", variant: "destructive" },
};

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export const invokeXeroPriceSync = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("xero-item-price-sync", { body });
  if (error) {
    const details = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details).error || details; } catch { /* keep text */ }
    throw new Error(msg);
  }
  return data as { rows: XeroPriceRow[]; results: any[] };
};

export const XeroPriceSyncCard = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-price-check"],
    queryFn: () => invokeXeroPriceSync({ action: "check" }),
    staleTime: 60_000,
  });

  const rows = data?.rows || [];
  const mismatched = rows.filter((r) => r.state === "mismatch");
  const visible = showAll ? rows : rows.filter((r) => r.state !== "match");

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await invokeXeroPriceSync({ action: "sync" });
      qc.setQueryData(["xero-price-check"], res);
      const ok = res.results.filter((r) => r.ok).length;
      const bad = res.results.length - ok;
      const perm = res.rows.some((r) => r.state === "no_permission");
      toast({
        title: `${ok} Xero price${ok === 1 ? "" : "s"} updated`,
        description: perm
          ? "Xero refused some updates — reconnect Xero in Settings so ART Admin can edit Products & Services."
          : bad ? `${bad} failed — see the list.` : "Xero now matches ART Admin.",
        variant: bad ? "destructive" : undefined,
      });
    } catch (e: any) {
      toast({ title: "Couldn't update Xero", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Xero Product Prices</CardTitle>
        <p className="text-sm text-muted-foreground">
          ART Admin is the source of truth. Each current or upcoming tour's twin/double share price is copied to the
          matching Xero product (by Xero Product Code) whenever the price changes. Past and cancelled tours are ignored.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSync} disabled={syncing || isFetching || !mismatched.length}>
            {syncing ? "Updating Xero…" : `Update ${mismatched.length} price${mismatched.length === 1 ? "" : "s"} in Xero`}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Checking…" : "Check again"}
          </Button>
          <Button variant="ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Hide matching tours" : "Show matching tours too"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isFetching && !error && !visible.length && (
          <p className="text-sm text-muted-foreground">All current and upcoming tour prices match Xero.</p>
        )}
        {visible.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Tour</th>
                  <th className="p-2">Starts</th>
                  <th className="p-2">Code</th>
                  <th className="p-2 text-right">ART Admin</th>
                  <th className="p-2 text-right">Xero now</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const s = STATE_LABEL[r.state] || { text: r.state, variant: "outline" as const };
                  return (
                    <tr key={r.tour_id} className="border-t">
                      <td className="p-2">{r.tour_name}</td>
                      <td className="p-2">{r.start_date ? format(new Date(r.start_date + "T00:00:00"), "dd/MM/yyyy") : "—"}</td>
                      <td className="p-2 font-mono">{r.code || "—"}</td>
                      <td className="p-2 text-right">{money(r.art_price)}</td>
                      <td className="p-2 text-right">{money(r.xero_price)}</td>
                      <td className="p-2"><Badge variant={s.variant}>{s.text}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
