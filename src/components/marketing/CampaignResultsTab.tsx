import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link2, Loader2, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useTours } from "@/hooks/useTours";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCampaignAttribution,
  useDeleteLinkClassification,
  useLinkClassifications,
  useMarketingSignals,
  useSaveLinkClassification,
  type LinkClassification,
} from "@/hooks/useMarketingIntelligence";

const INTENTS = [
  { value: "high_intent", label: "Ready to talk (enquiry / booking link)" },
  { value: "interest", label: "Looking at a tour" },
  { value: "informational", label: "General reading" },
];

const money = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })
    .format(n || 0);

const auDate = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM/yyyy") : "—");
const auDateTime = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM/yyyy HH:mm") : "—");

export function CampaignResultsTab() {
  const { hasEditAccess } = usePermissions();
  const { data: campaigns = [], isLoading } = useCampaignAttribution();
  const { data: signals = [], isLoading: signalsLoading } = useMarketingSignals(true, 60);
  const { data: rules = [] } = useLinkClassifications();
  const { data: tours = [] } = useTours();
  const saveRule = useSaveLinkClassification();
  const deleteRule = useDeleteLinkClassification();

  const [editing, setEditing] = useState<Partial<LinkClassification> | null>(null);

  const tourName = useMemo(
    () => new Map((tours as any[]).map((t) => [t.id, t.name])),
    [tours]
  );

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (acc, c) => ({
          sent: acc.sent + (c.sent || 0),
          opened: acc.opened + (c.opened || 0),
          clicked: acc.clicked + (c.clicked || 0),
          enquiries: acc.enquiries + (c.attributed_enquiries || 0),
          bookings: acc.bookings + (c.attributed_bookings || 0),
          value: acc.value + Number(c.booked_value || 0),
        }),
        { sent: 0, opened: 0, clicked: 0, enquiries: 0, bookings: 0, value: 0 }
      ),
    [campaigns]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Emails delivered</CardDescription>
            <CardTitle className="text-2xl">{totals.sent.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {totals.opened.toLocaleString()} opened · {totals.clicked.toLocaleString()} clicked
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Enquiries from campaigns</CardDescription>
            <CardTitle className="text-2xl">{totals.enquiries.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Counted only where the enquiry came from a campaign link
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Bookings from campaigns</CardDescription>
            <CardTitle className="text-2xl">{totals.bookings.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            One booking is only ever credited once
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Booking value</CardDescription>
            <CardTitle className="text-2xl">{money(totals.value)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Taken from the booking records, never estimated
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaign results</CardTitle>
          <CardDescription>
            What each send achieved — opens, clicks, the people who clicked something serious, and
            the enquiries and bookings that followed.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Ready to talk</TableHead>
                  <TableHead className="text-right">Enquiries</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-sm text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading results…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-sm text-muted-foreground">
                      No campaigns yet.
                    </TableCell>
                  </TableRow>
                )}
                {campaigns.map((c) => (
                  <TableRow key={c.campaign_id}>
                    <TableCell>
                      <div className="font-medium">{c.name || "Untitled"}</div>
                      <div className="text-xs text-muted-foreground">{c.subject}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {auDate(c.send_started_at)}
                    </TableCell>
                    <TableCell className="text-right">{c.sent}</TableCell>
                    <TableCell className="text-right">
                      {c.opened}
                      {c.open_rate != null && (
                        <span className="ml-1 text-xs text-muted-foreground">({c.open_rate}%)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.clicked}
                      {c.click_rate != null && (
                        <span className="ml-1 text-xs text-muted-foreground">({c.click_rate}%)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.high_intent_clickers ? (
                        <Badge variant="secondary">{c.high_intent_clickers}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.attributed_enquiries}</TableCell>
                    <TableCell className="text-right">{c.attributed_bookings}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {money(Number(c.booked_value || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4" /> People worth calling
            </CardTitle>
            <CardDescription>
              Recent clicks on enquiry or booking links, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {signalsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!signalsLoading && signals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Clicks appear here once a campaign goes out.
              </p>
            )}
            {signals.map((s) => (
              <div
                key={s.event_id}
                className="flex items-start justify-between gap-3 rounded-md border p-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.contact_name || s.link_url}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.intent_label || "Enquiry link"}
                    {s.intent_tour_id && tourName.get(s.intent_tour_id)
                      ? ` · ${tourName.get(s.intent_tour_id)}`
                      : ""}
                    {s.campaign_name ? ` · ${s.campaign_name}` : ""}
                  </div>
                </div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">
                  {auDateTime(s.occurred_at)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4" /> What a click means
                </CardTitle>
                <CardDescription>
                  Tell the system which links show real buying interest, so the right clicks stand
                  out.
                </CardDescription>
              </div>
              {hasEditAccess && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setEditing({ intent: "high_intent", is_active: true })}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No link rules yet — every click counts as general reading.
              </p>
            )}
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                <button
                  className="min-w-0 text-left"
                  onClick={() => hasEditAccess && setEditing(r)}
                  type="button"
                >
                  <div className="truncate text-sm font-medium">{r.url_pattern}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {INTENTS.find((i) => i.value === r.intent)?.label || r.intent}
                    {r.label ? ` · ${r.label}` : ""}
                    {r.tour_id && tourName.get(r.tour_id) ? ` · ${tourName.get(r.tour_id)}` : ""}
                    {!r.is_active ? " · off" : ""}
                  </div>
                </button>
                {hasEditAccess && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="Remove link rule"
                    onClick={() => deleteRule.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit link rule" : "New link rule"}</DialogTitle>
            <DialogDescription>
              Any link containing this text will be treated as the interest you choose.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Link contains</Label>
                <Input
                  value={editing.url_pattern || ""}
                  placeholder="/register-interest"
                  onChange={(e) => setEditing({ ...editing, url_pattern: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Treat as</Label>
                <Select
                  value={editing.intent || "high_intent"}
                  onValueChange={(v) => setEditing({ ...editing, intent: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENTS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Short description (optional)</Label>
                <Input
                  value={editing.label || ""}
                  placeholder="Clicked Register Interest"
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Relates to a tour (optional)</Label>
                <Select
                  value={editing.tour_id || "none"}
                  onValueChange={(v) => setEditing({ ...editing, tour_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No specific tour" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific tour</SelectItem>
                    {(tours as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <Label className="mb-0">Rule is on</Label>
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.url_pattern?.trim() || saveRule.isPending}
              onClick={async () => {
                await saveRule.mutateAsync(editing!);
                setEditing(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
