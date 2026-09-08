import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import {
  useActionBoard,
  useAttributionPerformance,
  useCrmDataQuality,
  useFunnel,
  usePipelineSummary,
  useResponsePerformance,
  useTourSales,
} from "@/hooks/useCrmSales";

const money = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );

const num = (n: any) => (n == null ? "—" : String(n));

const rangeFor = (days: string) => {
  if (days === "all") return { from: null, to: null };
  const d = new Date();
  d.setDate(d.getDate() - Number(days));
  return { from: d.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
};

/** Sales intelligence: what is happening now and what the numbers say. */
export function CrmDashboard() {
  const [days, setDays] = useState("30");
  const range = useMemo(() => rangeFor(days), [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
            <SelectItem value="all">Everything</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Unless a report says otherwise, figures cover enquiries <strong>received</strong> in this period.
        </p>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="tours">Tour sales</TabsTrigger>
          <TabsTrigger value="sources">Sources &amp; campaigns</TabsTrigger>
          <TabsTrigger value="quality">Data quality</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4"><TodayPanel /></TabsContent>
        <TabsContent value="pipeline" className="mt-4"><PipelinePanel range={range} /></TabsContent>
        <TabsContent value="conversion" className="mt-4"><ConversionPanel range={range} /></TabsContent>
        <TabsContent value="response" className="mt-4"><ResponsePanel range={range} /></TabsContent>
        <TabsContent value="tours" className="mt-4"><TourSalesPanel range={range} /></TabsContent>
        <TabsContent value="sources" className="mt-4"><SourcesPanel range={range} /></TabsContent>
        <TabsContent value="quality" className="mt-4"><QualityPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function TodayPanel() {
  const { data, isLoading } = useActionBoard();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="New enquiries" value={data.new_leads.length} />
      <Stat label="Never contacted" value={data.uncontacted.length} tone="text-amber-600" />
      <Stat label="Client replies waiting" value={data.client_replies.length} />
      <Stat label="Due today" value={data.due_today.length} />
      <Stat label="Overdue" value={data.overdue.length} tone="text-destructive" />
      <Stat label="No next action" value={data.no_next_action.length} tone="text-destructive" />
      <Stat label="Going cold" value={data.stale.length} tone="text-amber-600" />
      <Stat label="High priority" value={data.high_priority.length} />
      <Stat label="Booking enquiries" value={data.booking_enquiries.length} />
      <Stat label="Nurture to review" value={data.nurture_due.length} />
    </div>
  );
}

function PipelinePanel({ range }: { range: { from?: string | null; to?: string | null } }) {
  const { data, isLoading } = usePipelineSummary(range);
  const { data: users = [] } = useAssignableUsers();
  if (isLoading || !data) return <Loading />;
  const userName = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.first_name + " " + (users.find((u) => u.id === id)?.last_name || "") : "Nobody assigned";

  return (
    <div className="space-y-4">
      <Basis text={data.basis} />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">By stage</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Enquiries</TableHead>
                <TableHead className="text-right">People travelling</TableHead>
                <TableHead className="text-right">Numbers unknown</TableHead>
                <TableHead className="text-right">Avg age (days)</TableHead>
                <TableHead className="text-right">Avg in stage (work days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.by_stage || []).map((r: any) => (
                <TableRow key={r.stage}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right">{r.leads}</TableCell>
                  <TableCell className="text-right">{r.passengers}</TableCell>
                  <TableCell className="text-right">{r.passengers_unknown}</TableCell>
                  <TableCell className="text-right">{num(r.avg_age_days)}</TableCell>
                  <TableCell className="text-right">{num(r.avg_days_in_stage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Strongest tour pipelines</CardTitle>
            <CardDescription>Open enquiries and the people they represent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.by_tour || []).slice(0, 12).map((r: any) => (
              <div key={r.tour} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.tour}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.active_leads} open · {r.passengers} people · {r.won} booked
                </span>
              </div>
            ))}
            {!data.by_tour?.length && <Empty />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By salesperson</CardTitle>
            <CardDescription>Workload and anything being neglected.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.by_owner || []).map((r: any) => (
              <div key={r.owner_id || "none"} className="flex items-center justify-between gap-2">
                <span className="truncate">{userName(r.owner_id)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.active_leads} open · {r.won} booked
                  {r.no_next_action ? ` · ${r.no_next_action} with no next action` : ""}
                  {r.stale ? ` · ${r.stale} cold` : ""}
                </span>
              </div>
            ))}
            {!data.by_owner?.length && <Empty />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConversionPanel({ range }: { range: any }) {
  const { data, isLoading } = useFunnel(range);
  if (isLoading || !data) return <Loading />;
  const steps = [
    ["Enquiries received", data.received],
    ["Contacted", data.contacted],
    ["Qualified / considering", data.qualified],
    ["Booking in progress", data.booking_in_progress],
    ["Booked", data.booked],
  ] as [string, number][];

  return (
    <div className="space-y-4">
      <Basis text={data.basis} />
      <Card>
        <CardContent className="space-y-3 p-4">
          {steps.map(([label, value]) => {
            const pct = data.received ? Math.round((value / data.received) * 100) : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{value} · {pct}%</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enquiry conversion" value={data.conversion_rate == null ? "—" : `${data.conversion_rate}%`} />
        <Stat label="Still active" value={data.still_active} />
        <Stat label="Long-term nurture" value={data.nurture} />
        <Stat label="Lost" value={data.lost} />
        <Stat label="People represented" value={data.prospective_passengers} />
        <Stat label="People booked" value={data.booked_passengers} />
        <Stat
          label="Passenger conversion"
          value={
            data.prospective_passengers
              ? `${Math.round((data.booked_passengers / data.prospective_passengers) * 100)}%`
              : "—"
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Passenger conversion compares people booked with the people enquiries said they were travelling with.
        It is not the same thing as enquiry conversion.
      </p>
    </div>
  );
}

function ResponsePanel({ range }: { range: any }) {
  const { data, isLoading } = useResponsePerformance(range);
  const { data: users = [] } = useAssignableUsers();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <Basis text={data.basis} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Target" value={`${data.target_hours} hrs`} />
        <Stat label="Median" value={data.median_hours == null ? "—" : `${data.median_hours} hrs`} />
        <Stat label="Average" value={data.average_hours == null ? "—" : `${data.average_hours} hrs`} />
        <Stat label="Within target" value={data.within_target_pct == null ? "—" : `${data.within_target_pct}%`} />
        <Stat label="Still waiting" value={data.awaiting_response} tone="text-destructive" />
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">By salesperson</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {(data.by_owner || []).map((r: any) => {
            const u = users.find((x) => x.id === r.owner_id);
            return (
              <div key={r.owner_id || "none"} className="flex items-center justify-between gap-2">
                <span>{u ? `${u.first_name} ${u.last_name}` : "Nobody assigned"}</span>
                <span className="text-muted-foreground">
                  {r.leads} enquiries · median {r.median_hours == null ? "—" : `${r.median_hours} hrs`}
                  {r.awaiting ? ` · ${r.awaiting} still waiting` : ""}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function TourSalesPanel({ range }: { range: any }) {
  const [includePast, setIncludePast] = useState(false);
  const { data = [], isLoading } = useTourSales(range, includePast);
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => setIncludePast((v) => !v)}>
        {includePast ? "Upcoming tours only" : "Include past tours"}
      </Button>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tour sales position</CardTitle>
          <CardDescription>
            Bookings and capacity come from the booking system; enquiry figures cover the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tour</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">New enquiries</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">People in pipeline</TableHead>
                <TableHead className="text-right">Booking in progress</TableHead>
                <TableHead className="text-right">Registered interest</TableHead>
                <TableHead className="text-right">Nurture</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Booking value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.tour_id}>
                  <TableCell className="min-w-[180px]">{r.tour}</TableCell>
                  <TableCell className="text-right">{num(r.capacity)}</TableCell>
                  <TableCell className="text-right">{r.booked_passengers}</TableCell>
                  <TableCell className="text-right">{num(r.remaining)}</TableCell>
                  <TableCell className="text-right">{r.new_leads}</TableCell>
                  <TableCell className="text-right">{r.active_leads}</TableCell>
                  <TableCell className="text-right">
                    {r.prospective_passengers}
                    {r.passengers_unknown ? <span className="text-muted-foreground"> (+{r.passengers_unknown} unknown)</span> : null}
                  </TableCell>
                  <TableCell className="text-right">{r.booking_in_progress}</TableCell>
                  <TableCell className="text-right">{r.registered_interest}</TableCell>
                  <TableCell className="text-right">{r.nurture}</TableCell>
                  <TableCell className="text-right">{r.lost}</TableCell>
                  <TableCell className="text-right">{r.conversion_rate == null ? "—" : `${r.conversion_rate}%`}</TableCell>
                  <TableCell className="text-right">{money(r.booking_revenue)}</TableCell>
                </TableRow>
              ))}
              {!data.length && (
                <TableRow><TableCell colSpan={13} className="text-center text-sm text-muted-foreground">No tours to show.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SourcesPanel({ range }: { range: any }) {
  const { data, isLoading } = useAttributionPerformance(range);
  const { data: users = [] } = useAssignableUsers();
  if (isLoading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <Basis text={data.basis} />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Where enquiries come from</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Enquiries</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">People booked</TableHead>
                <TableHead className="text-right">Booking value</TableHead>
                <TableHead className="text-right">Median response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.by_source || []).map((r: any) => (
                <TableRow key={`${r.key}-${r.channel}`}>
                  <TableCell className="capitalize">{String(r.key).replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right">{r.leads}</TableCell>
                  <TableCell className="text-right">{r.active}</TableCell>
                  <TableCell className="text-right">{r.won}</TableCell>
                  <TableCell className="text-right">{r.conversion_rate == null ? "—" : `${r.conversion_rate}%`}</TableCell>
                  <TableCell className="text-right">{r.booked_passengers}</TableCell>
                  <TableCell className="text-right">{money(r.revenue)}</TableCell>
                  <TableCell className="text-right">{r.median_response_hours == null ? "—" : `${r.median_response_hours} hrs`}</TableCell>
                </TableRow>
              ))}
              {!data.by_source?.length && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nothing yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campaigns and ads</CardTitle>
            <CardDescription>Campaign, ad set and ad as recorded with the enquiry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.by_campaign || []).slice(0, 15).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {r.campaign}
                  {r.ad_set !== "—" && <span className="text-muted-foreground"> · {r.ad_set}</span>}
                  {r.ad !== "—" && <span className="text-muted-foreground"> · {r.ad}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {r.leads} enquiries · {r.won} booked · {money(r.revenue)}
                </span>
              </div>
            ))}
            {!data.by_campaign?.length && <Empty />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Partners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.by_partner || []).map((r: any) => (
              <div key={r.partner} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.partner}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.leads} enquiries · {r.won} booked · {money(r.revenue)}
                </span>
              </div>
            ))}
            {!data.by_partner?.length && <Empty />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Why we lose enquiries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.lost_analysis || []).map((r: any) => (
              <div key={r.reason} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.reason}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </div>
            ))}
            {!data.lost_analysis?.length && <Empty />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Salesperson results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data.by_owner || []).map((r: any) => {
              const u = users.find((x) => x.id === r.owner_id);
              return (
                <div key={r.owner_id || "none"} className="flex items-center justify-between gap-2">
                  <span>{u ? `${u.first_name} ${u.last_name}` : "Nobody assigned"}</span>
                  <span className="text-muted-foreground">
                    {r.leads} enquiries · {r.won} booked
                    {r.conversion_rate != null ? ` · ${r.conversion_rate}%` : ""} · {money(r.revenue)}
                  </span>
                </div>
              );
            })}
            {!data.by_owner?.length && <Empty />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualityPanel() {
  const { data, isLoading } = useCrmDataQuality();
  if (isLoading || !data) return <Loading />;
  const warnings = [
    ["Active enquiries with nobody looking after them", data.missing_owner],
    ["Active enquiries with no tour", data.missing_tour],
    ["Active enquiries where we don't know how many people are travelling", data.passengers_unknown],
    ["Lost enquiries without a recorded reason", data.lost_without_reason],
    ["Booked enquiries not linked to a booking", data.won_without_booking],
    ["Linked bookings with no value recorded", data.booked_without_revenue],
    ["Enquiries with no source recorded", data.no_source],
  ] as [string, number][];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What the numbers can and cannot tell you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Enquiry records begin on {new Date(data.crm_era_start).toLocaleDateString("en-AU")}. There are{" "}
            {data.total_leads} enquiries in total, {data.leads_before_crm_era} of them dated before that day —
            so conversion rates for earlier periods are not meaningful.
          </p>
          <p className="text-muted-foreground">
            {data.imported_email_history} imported emails give history for contacts, but they are not enquiries.
            Of {data.bookings_total} live bookings, {data.bookings_linked_to_lead} are linked to an enquiry — the rest
            were taken before the enquiry system, or directly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Gaps worth tidying</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {warnings.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {value > 0 && <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
                {label}
              </span>
              <Badge variant={value > 0 ? "destructive" : "secondary"}>{value}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="sm">
        <Link to="/leads?ltab=pipeline">Fix them in the pipeline</Link>
      </Button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${tone || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

const Loading = () => <p className="p-6 text-sm text-muted-foreground">Loading sales numbers…</p>;
const Empty = () => <p className="text-muted-foreground">Nothing yet.</p>;
const Basis = ({ text }: { text?: string }) =>
  text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
