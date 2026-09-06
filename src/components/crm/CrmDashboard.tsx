import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrmDashboard } from "@/hooks/useCrm";

const money = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n || 0);

/** Sales snapshot: what arrived, what is converting and where it comes from. */
export function CrmDashboard() {
  const [days, setDays] = useState("30");
  const { data, isLoading } = useCrmDashboard(Number(days));

  const bySource = useMemo(() => {
    const map = new Map<string, { total: number; won: number }>();
    for (const l of data?.leads || []) {
      const key = l.source || "unknown";
      const row = map.get(key) || { total: 0, won: 0 };
      row.total += 1;
      if (l.converted_at) row.won += 1;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  }, [data]);

  const byTour = useMemo(() => {
    const map = new Map<string, { total: number; open: number; won: number }>();
    for (const l of data?.leads || []) {
      const key = l.tour?.name || "No specific tour";
      const row = map.get(key) || { total: 0, open: 0, won: 0 };
      row.total += 1;
      if (l.converted_at) row.won += 1;
      else if (!l.closed_at) row.open += 1;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  }, [data]);

  const byLostReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of data?.leads || []) {
      if (!l.lost_reason) continue;
      map.set(l.lost_reason, (map.get(l.lost_reason) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading sales numbers…</p>;
  }

  const m = data.metrics;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enquiries received" value={m.received} />
        <Stat label="Open enquiries" value={m.openTotal} />
        <Stat label="Converted to booking" value={m.won} />
        <Stat label="Conversion" value={`${m.conversionRate}%`} />
        <Stat label="Pipeline value" value={money(m.pipelineValue)} />
        <Stat label="Booked value" value={money(m.wonValue)} />
        <Stat
          label="First response"
          value={m.avgResponseHours == null ? "—" : `${m.avgResponseHours.toFixed(1)} hrs`}
        />
        <Stat
          label="Time to booking"
          value={m.avgDaysToBooking == null ? "—" : `${m.avgDaysToBooking.toFixed(1)} days`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Uncontacted" value={data.uncontacted.length} tone="text-amber-600" />
        <Stat label="Due today" value={data.dueToday.length} />
        <Stat label="Overdue follow-ups" value={data.overdue.length} tone="text-destructive" />
        <Stat label="No next action" value={data.noNextAction.length} tone="text-destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Where enquiries come from</CardTitle>
            <CardDescription>Enquiries and bookings by source.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {bySource.map(([source, row]) => (
              <div key={source} className="flex items-center justify-between gap-2">
                <span className="capitalize">{source.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {row.total} · <span className="text-foreground">{row.won} booked</span>
                </span>
              </div>
            ))}
            {bySource.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Strongest tour pipelines</CardTitle>
            <CardDescription>Open enquiries per tour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {byTour.map(([tour, row]) => (
              <div key={tour} className="flex items-center justify-between gap-2">
                <span className="truncate">{tour}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.open} open · {row.won} booked
                </span>
              </div>
            ))}
            {byTour.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Why we lose enquiries</CardTitle>
            <CardDescription>Recorded lost reasons.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {byLostReason.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between gap-2">
                <span className="capitalize">{reason.replace(/_/g, " ")}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
            {byLostReason.length === 0 && <p className="text-muted-foreground">Nothing recorded yet.</p>}
          </CardContent>
        </Card>
      </div>
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
