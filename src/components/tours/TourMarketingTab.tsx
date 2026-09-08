import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Loader2,
  Mail,
  MousePointerClick,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTourMarketingIntelligence,
  useTourMarketingPeople,
  type TourMarketingMetric,
} from "@/hooks/useTourMarketingIntelligence";

interface Props {
  tourId: string;
  tourName: string;
}

const auDate = (v?: string | null) => (v ? format(new Date(v), "dd/MM/yyyy") : "—");

const money = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(
    v || 0
  );

/** Only show a trend when both periods carry enough comparable activity. */
const MIN_COMPARABLE = 20;

const Metric = ({
  label,
  value,
  hint,
  unit,
  onOpen,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  unit?: string;
  onOpen?: () => void;
  trend?: number | null;
}) => (
  <div className="rounded-lg border bg-background p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="flex items-baseline gap-2">
      {onOpen ? (
        <button
          className="text-2xl font-semibold underline-offset-4 hover:underline"
          onClick={onOpen}
        >
          {value}
        </button>
      ) : (
        <span className="text-2xl font-semibold">{value}</span>
      )}
      {trend !== null && trend !== undefined && (
        <span
          className={`flex items-center text-xs ${trend >= 0 ? "text-emerald-600" : "text-destructive"}`}
        >
          {trend >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    {unit && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{unit}</p>}
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const METRIC_TITLES: Record<TourMarketingMetric, string> = {
  interested: "Contacts interested in this tour",
  interested_not_booked: "Interested but not booked",
  nurture_leads: "Long-term nurture enquiries",
  active_leads: "Active enquiries",
  emailed: "Contacts emailed about this tour",
  opened: "Contacts who opened",
  clicked: "Contacts who clicked",
  meaningful_clicks: "Meaningful clicks about this tour",
  enquiries: "Enquiries that followed an email",
  bookings: "Bookings that followed an email",
};

export function TourMarketingTab({ tourId, tourName }: Props) {
  const [days, setDays] = useState(30);
  const [drill, setDrill] = useState<TourMarketingMetric | null>(null);
  const { data, isLoading, error } = useTourMarketingIntelligence(tourId, days);
  const people = useTourMarketingPeople(tourId, drill ?? undefined, days);

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading marketing intelligence…
      </div>
    );

  if (error || !data)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Marketing intelligence is not available right now.
      </p>
    );

  const cur = data.current;
  const prev = data.previous;
  const aud = data.audience;

  const comparable =
    cur.emailed_contacts >= MIN_COMPARABLE && prev.emailed_contacts >= MIN_COMPARABLE;

  const trend = (a: number, b: number): number | null => {
    if (!comparable || !b) return null;
    return Math.round(((a - b) / b) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Marketing &amp; enquiry intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Real figures for {tourName} — no scores or estimates.
          </p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Email engagement tracking is available from{" "}
          <strong>{data.tracking_since ? auDate(data.tracking_since) : "no sends tracked yet"}</strong>
          . Campaigns sent before then have no opens or clicks recorded, so nothing is shown for them.
          {!comparable && " Not enough activity in both periods to compare trends yet."}
        </span>
      </div>

      {/* Audience */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Audience — unique contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Interested contacts"
            value={aud.interested_contacts}
            unit="unique contacts"
            onOpen={() => setDrill("interested")}
          />
          <Metric
            label="Marketing eligible of those"
            value={aud.marketing_eligible_interested}
            unit="unique contacts"
            hint="Consented, not unsubscribed or bounced"
          />
          <Metric
            label="Active enquiries"
            value={aud.active_leads}
            unit="enquiries"
            onOpen={() => setDrill("active_leads")}
          />
          <Metric
            label="Long-term nurture"
            value={aud.nurture_leads}
            unit="enquiries"
            onOpen={() => setDrill("nurture_leads")}
          />
          <Metric label="Booked passengers" value={aud.booked_passengers} unit="passengers" />
          <Metric label="Booked contacts" value={aud.booked_contacts} unit="unique contacts" />
          <Metric
            label="Interested but not booked"
            value={aud.interested_not_booked}
            unit="unique contacts"
            onOpen={() => setDrill("interested_not_booked")}
          />
          <Metric
            label="…and marketing eligible"
            value={aud.interested_not_booked_eligible}
            unit="unique contacts"
            hint="Ready to market to"
          />
        </CardContent>
      </Card>

      {/* Marketing activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Marketing activity — last {days} days
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Contacts emailed"
            value={cur.emailed_contacts}
            unit="unique contacts"
            hint={`${cur.sends} email sends`}
            onOpen={() => setDrill("emailed")}
            trend={trend(cur.emailed_contacts, prev.emailed_contacts)}
          />
          <Metric
            label="Opened"
            value={cur.opened_contacts}
            unit="unique contacts"
            onOpen={() => setDrill("opened")}
            trend={trend(cur.opened_contacts, prev.opened_contacts)}
          />
          <Metric
            label="Clicked"
            value={cur.clicked_contacts}
            unit="unique contacts"
            onOpen={() => setDrill("clicked")}
            trend={trend(cur.clicked_contacts, prev.clicked_contacts)}
          />
          <Metric
            label="Meaningful tour clicks"
            value={cur.meaningful_click_contacts}
            unit="unique contacts"
            hint={`${cur.meaningful_click_events} click events`}
            onOpen={() => setDrill("meaningful_clicks")}
            trend={trend(cur.meaningful_click_contacts, prev.meaningful_click_contacts)}
          />
          <Metric
            label="Register interest clicks"
            value={cur.register_interest_click_events}
            unit="click events"
          />
          <Metric
            label="Campaigns about this tour"
            value={data.campaigns.length}
            unit="campaigns"
          />
        </CardContent>
      </Card>

      {/* Sales outcome */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointerClick className="h-4 w-4" /> What followed — last {days} days
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Enquiries attributed"
            value={cur.enquiries}
            unit="enquiries"
            onOpen={() => setDrill("enquiries")}
          />
          <Metric label="Prospective passengers" value={cur.prospective_passengers} unit="people" />
          <Metric
            label="Bookings attributed"
            value={cur.bookings}
            unit="bookings"
            onOpen={() => setDrill("bookings")}
          />
          <Metric label="Booked passengers" value={cur.booked_passengers} unit="passengers" />
          <Metric label="Booking value" value={money(Number(cur.booked_value))} unit="from bookings" />
        </CardContent>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            An enquiry or booking is only counted here when the person came through a tracked link
            from a campaign — receiving an email alone never counts.
          </p>
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Funnel — last {days} days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Marketing eligible audience", value: aud.marketing_eligible_interested, metric: "interested" as TourMarketingMetric },
            { label: "Emailed", value: cur.emailed_contacts, metric: "emailed" as TourMarketingMetric },
            { label: "Opened", value: cur.opened_contacts, metric: "opened" as TourMarketingMetric },
            { label: "Meaningful click", value: cur.meaningful_click_contacts, metric: "meaningful_clicks" as TourMarketingMetric },
            { label: "Enquiry", value: cur.enquiries, metric: "enquiries" as TourMarketingMetric },
            { label: "Booking", value: cur.bookings, metric: "bookings" as TourMarketingMetric },
          ].map((step, i, arr) => {
            const top = arr[0].value || 0;
            const pct = top ? Math.round((step.value / top) * 100) : 0;
            return (
              <button
                key={step.label}
                className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40"
                onClick={() => setDrill(step.metric)}
              >
                <span className="w-56 shrink-0 text-sm">{step.label}</span>
                <span className="h-2 flex-1 rounded bg-muted">
                  <span
                    className="block h-2 rounded bg-primary"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-semibold">
                  {step.value}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Booked passengers {cur.booked_passengers} · Booking value {money(Number(cur.booked_value))}
          </p>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaigns associated with this tour</CardTitle>
        </CardHeader>
        <CardContent>
          {data.campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaign has been linked to this tour yet. Campaigns link automatically once a
              tracked link for this tour is clicked, or an enquiry for this tour is credited to a
              campaign.
            </p>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map((c) => (
                <div
                  key={c.campaign_id}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm"
                >
                  <span className="font-medium">{c.name || "Untitled campaign"}</span>
                  <Badge variant="outline">{c.status || "draft"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {auDate(c.send_started_at)}
                  </span>
                  <span className="ml-auto flex gap-3 text-xs text-muted-foreground">
                    <span>{c.sent} sent</span>
                    <span>{c.opened} opened</span>
                    <span>{c.clicked} clicked</span>
                    <span>{c.high_intent_clickers} meaningful</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drill ? METRIC_TITLES[drill] : ""}</DialogTitle>
            <DialogDescription>
              The underlying records behind this number.
            </DialogDescription>
          </DialogHeader>
          {people.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (people.data || []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Nothing to show yet.</p>
          ) : (
            <div className="space-y-1">
              {(people.data || []).map((p, i) => (
                <div
                  key={`${p.customer_id || p.email}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="font-medium">{p.name?.trim() || p.email || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{p.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {p.detail}
                    {p.occurred_at ? ` · ${auDate(p.occurred_at)}` : ""}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Showing {(people.data || []).length} record
                {(people.data || []).length === 1 ? "" : "s"}.
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDrill(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TourMarketingTab;
