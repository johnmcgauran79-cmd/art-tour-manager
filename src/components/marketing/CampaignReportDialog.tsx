import { useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Link2, Pencil, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useCampaignRecipients, type MarketingCampaign } from "@/hooks/useMarketing";

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "—";

const dt = (iso?: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yyyy HH:mm") : "—";

interface Props {
  campaign: MarketingCampaign | null;
  onClose: () => void;
  /** Optional escape hatch so a sent campaign can still be opened in the editor. */
  onEdit?: (campaign: MarketingCampaign) => void;
}

export function CampaignReportDialog({ campaign, onClose, onEdit }: Props) {
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(
    campaign?.id
  );

  const { data: events = [] } = useQuery({
    queryKey: ["campaign-events", campaign?.id],
    enabled: !!campaign?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_events")
        .select("event_type, link_url")
        .eq("campaign_id", campaign!.id)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: unique = { sent: 0, opened: 0, clicked: 0, bounced: 0 } } = useQuery({
    queryKey: ["campaign-unique-counts", campaign?.id],
    enabled: !!campaign?.id,
    queryFn: async () => {
      const c = async (apply: (q: any) => any) => {
        const { count, error } = await apply(
          supabase
            .from("campaign_recipients")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaign!.id)
        );
        if (error) throw error;
        return count ?? 0;
      };
      const [sent, opened, clicked, bounced] = await Promise.all([
        c((q) => q.not("sent_at", "is", null)),
        c((q) => q.not("opened_at", "is", null)),
        c((q) => q.not("clicked_at", "is", null)),
        c((q) => q.eq("status", "bounced")),
      ]);
      return { sent, opened, clicked, bounced };
    },
  });

  const topLinks = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events as any[]) {
      if (e.event_type === "click" && e.link_url)
        map.set(e.link_url, (map.get(e.link_url) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [events]);

  const stats: [string, string | number][] = campaign
    ? [
        ["Status", campaign.status],
        ["Recipients", campaign.total_recipients ?? 0],
        ["Delivered", `${campaign.sent_count ?? 0} (${pct(campaign.sent_count ?? 0, campaign.total_recipients ?? 0)})`],
        ["Failed", campaign.failed_count ?? 0],
        ["Opens (events)", campaign.open_count ?? 0],
        ["Clicks (events)", campaign.click_count ?? 0],
        ["Unique openers", `${unique.opened} (${pct(unique.opened, unique.sent)})`],
        ["Unique clickers", `${unique.clicked} (${pct(unique.clicked, unique.sent)})`],
        ["Bounces", `${Math.max(unique.bounced, campaign.bounce_count ?? 0)} (${pct(Math.max(unique.bounced, campaign.bounce_count ?? 0), unique.sent)})`],
        ["Unsubscribes", campaign.unsubscribe_count ?? 0],
        ["Send started", dt(campaign.send_started_at)],
        ["Send completed", dt(campaign.send_completed_at)],
        [
          "From",
          `${campaign.from_name || ""} ${campaign.from_email ? `<${campaign.from_email}>` : ""}`.trim() ||
            "—",
        ],
        ["Reply-to", campaign.reply_to || "—"],
      ]
    : [];

  return (
    <Dialog open={!!campaign} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{campaign?.name}</DialogTitle>
          <DialogDescription>{campaign?.subject}</DialogDescription>
        </DialogHeader>

        {campaign && (
          <Tabs defaultValue="stats">
            <TabsList>
              <TabsTrigger value="stats" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Performance
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Email preview
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Links clicked
              </TabsTrigger>
              <TabsTrigger value="recipients" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Recipients
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="mt-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-0.5 break-words text-sm font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Opens and clicks are counted per event; unique figures count each contact once.
              </p>
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <div className="rounded-md border bg-muted/30 p-2">
                <iframe
                  title="Sent email preview"
                  sandbox=""
                  srcDoc={campaign.html_body || "<p>No content stored for this campaign.</p>"}
                  className="h-[65vh] w-full rounded bg-white"
                />
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-3">
              <div className="max-h-[55vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topLinks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                          No link clicks recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {topLinks.map(([url, clicks]) => (
                      <TableRow key={url}>
                        <TableCell className="max-w-[520px] break-all text-sm">{url}</TableCell>
                        <TableCell className="text-right">{clicks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                          {dt(r.sent_at)}
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
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onEdit && campaign && (
            <Button variant="secondary" className="gap-1.5" onClick={() => onEdit(campaign)}>
              <Pencil className="h-4 w-4" /> Open in editor
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
