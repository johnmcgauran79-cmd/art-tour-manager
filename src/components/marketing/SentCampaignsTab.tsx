import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  Eye,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useCampaignRecipients,
  useCampaigns,
  useRetryFailedRecipients,
  useSaveCampaign,
  type MarketingCampaign,
} from "@/hooks/useMarketing";


const statusVariant: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  cancelled: "destructive",
};

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "—";

interface SentCampaignsTabProps {
  /** Open a freshly created resend draft in the Campaigns tab. */
  onResend?: (campaignId: string) => void;
}

export function SentCampaignsTab({ onResend }: SentCampaignsTabProps = {}) {
  const { toast } = useToast();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const save = useSaveCampaign();
  const retry = useRetryFailedRecipients();
  const [detail, setDetail] = useState<MarketingCampaign | null>(null);
  const [retryTarget, setRetryTarget] = useState<MarketingCampaign | null>(null);

  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(
    detail?.id
  );

  /** Everything that has left (or is queued to leave) the building. */
  const rows = useMemo(
    () =>
      campaigns.filter((c) =>
        ["sent", "sending", "scheduled", "cancelled"].includes(c.status)
      ),
    [campaigns]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, c) => {
          acc.campaigns++;
          acc.sent += c.sent_count || 0;
          acc.opens += c.open_count || 0;
          acc.clicks += c.click_count || 0;
          acc.bounces += c.bounce_count || 0;
          acc.unsubscribes += c.unsubscribe_count || 0;
          return acc;
        },
        { campaigns: 0, sent: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 }
      ),
    [rows]
  );

  const resend = async (c: MarketingCampaign) => {
    const { id, created_at, updated_at, ...rest } = c as any;
    const created = await save.mutateAsync({
      ...rest,
      name: `${c.name} (resend)`,
      status: "draft",
      scheduled_send_at: null,
      send_started_at: null,
      send_completed_at: null,
      total_recipients: 0,
      sent_count: 0,
      failed_count: 0,
      open_count: 0,
      click_count: 0,
      bounce_count: 0,
      unsubscribe_count: 0,
    });
    if (!created?.id) return;
    toast({
      title: "Resend draft created",
      description: "Choose the audience — or paste specific addresses — then review and send.",
    });
    setDetail(null);
    onResend?.(created.id);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every marketing email that has been sent, is sending, or is scheduled — with delivery,
        open, click and bounce performance. Open one to preview exactly what went out, or resend it
        to a new audience.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Campaigns", value: totals.campaigns, icon: Mail },
          { label: "Emails sent", value: totals.sent, icon: Send },
          { label: "Open rate", value: pct(totals.opens, totals.sent), icon: Eye },
          { label: "Click rate", value: pct(totals.clicks, totals.sent), icon: MousePointerClick },
          { label: "Bounces", value: totals.bounces, icon: AlertTriangle },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </div>
              <div className="mt-1 text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Emails sent
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent / scheduled</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Bounces</TableHead>
                  <TableHead className="text-right">Unsubs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      Nothing sent yet — send a campaign and it will appear here.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.subject}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status] || "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {c.send_completed_at || c.send_started_at
                        ? format(new Date(c.send_completed_at || c.send_started_at!), "dd/MM/yyyy HH:mm")
                        : c.scheduled_send_at
                          ? format(new Date(c.scheduled_send_at), "dd/MM/yyyy HH:mm")
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">{c.total_recipients}</TableCell>
                    <TableCell className="text-right">{c.sent_count}</TableCell>
                    <TableCell className="text-right">
                      {c.open_count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {pct(c.open_count, c.sent_count)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.click_count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {pct(c.click_count, c.sent_count)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{c.bounce_count}</TableCell>
                    <TableCell className="text-right">{c.unsubscribe_count}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {(c.failed_count || 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Retry failed recipients"
                            title={`Retry ${c.failed_count} failed recipient(s)`}
                            disabled={retry.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRetryTarget(c);
                            }}
                          >
                            {retry.isPending && retryTarget?.id === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Preview email"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(c);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Resend campaign"
                          disabled={save.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            resend(c);
                          }}
                        >
                          {save.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------ detail / preview ---------------------------- */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{detail?.subject}</DialogDescription>
          </DialogHeader>

          {detail && (
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Email preview
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> Performance
                </TabsTrigger>
                <TabsTrigger value="recipients" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Recipients
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-3">
                <div className="rounded-md border bg-muted/30 p-2">
                  <iframe
                    title="Sent email preview"
                    srcDoc={detail.html_body || "<p>No content stored for this campaign.</p>"}
                    className="h-[60vh] w-full rounded bg-white"
                  />
                </div>
              </TabsContent>

              <TabsContent value="stats" className="mt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Recipients", detail.total_recipients],
                    ["Delivered", detail.sent_count],
                    ["Failed", detail.failed_count],
                    ["Opens", `${detail.open_count} (${pct(detail.open_count, detail.sent_count)})`],
                    ["Clicks", `${detail.click_count} (${pct(detail.click_count, detail.sent_count)})`],
                    ["Bounces", detail.bounce_count],
                    ["Unsubscribes", detail.unsubscribe_count],
                    [
                      "From",
                      `${detail.from_name || ""} ${detail.from_email ? `<${detail.from_email}>` : ""}`.trim() ||
                        "—",
                    ],
                    ["Reply-to", detail.reply_to || "—"],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-0.5 break-words text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recipients" className="mt-3">
                <div className="max-h-[55vh] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead className="text-right">Opens</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipientsLoading && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            Loading recipients…
                          </TableCell>
                        </TableRow>
                      )}
                      {!recipientsLoading && recipients.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            No recipient records for this campaign.
                          </TableCell>
                        </TableRow>
                      )}
                      {(recipients as any[]).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "bounced" || r.status === "failed"
                                  ? "destructive"
                                  : r.status === "sent"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {r.status}
                            </Badge>
                            {r.error_message && (
                              <div className="mt-0.5 text-xs text-destructive">{r.error_message}</div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {r.sent_at ? format(new Date(r.sent_at), "dd/MM/yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-right">{r.open_count ?? 0}</TableCell>
                          <TableCell className="text-right">{r.click_count ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            <Button
              className="gap-1.5"
              disabled={save.isPending || !detail}
              onClick={() => detail && resend(detail)}
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Resend to…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
