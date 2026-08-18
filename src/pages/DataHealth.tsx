import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ActivitySquare,
  ChevronDown,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { HealthScoreBadge } from "@/components/datahealth/HealthScoreBadge";
import { IntegrationStatusPanel } from "@/components/datahealth/IntegrationStatusPanel";
import {
  CHECK_LABELS,
  DATA_HEALTH_CHECKS,
  useDataHealth,
  type DataHealthCheckId,
  type DataHealthWindow,
} from "@/hooks/useDataHealth";
import { downloadCsv, exportStamp } from "@/lib/csvExport";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: "30", label: "Next 30 days" },
  { value: "60", label: "Next 60 days" },
  { value: "120", label: "Next 120 days" },
  { value: "0", label: "All upcoming" },
];

export default function DataHealth() {
  const navigate = useNavigate();
  const [windowDays, setWindowDays] = useState<DataHealthWindow>(120);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DataHealthCheckId | "all">("all");

  const { data, isLoading, isFetching, refetch } = useDataHealth(windowDays);

  const tours = useMemo(() => {
    const rows = data?.tours || [];
    const term = search.trim().toLowerCase();
    return rows.filter((t) => (term ? t.tourName.toLowerCase().includes(term) : true));
  }, [data, search]);

  const categoryItems = useMemo(() => {
    const items = data?.allItems || [];
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.checkId !== category) return false;
      if (!term) return true;
      return (
        i.tourName.toLowerCase().includes(term) ||
        i.subject.toLowerCase().includes(term) ||
        i.detail.toLowerCase().includes(term)
      );
    });
  }, [data, category, search]);

  const exportTours = () =>
    downloadCsv(
      `data-health-tours-${exportStamp()}`,
      tours,
      [
        { header: "Tour", value: (t) => t.tourName },
        { header: "Departs", value: (t) => formatDateToDDMMYYYY(t.startDate) },
        { header: "Days out", value: (t) => t.daysOut ?? "" },
        { header: "Bookings", value: (t) => t.bookings },
        { header: "Passengers", value: (t) => t.pax },
        { header: "Ops readiness", value: (t) => t.opsScore },
        { header: "Guest data", value: (t) => t.guestScore },
        { header: "Ops issues", value: (t) => t.opsItems.length },
        { header: "Guest data issues", value: (t) => t.guestItems.length },
        {
          header: "Categories",
          value: (t) =>
            Object.entries(t.byCheck)
              .map(([k, v]) => `${CHECK_LABELS[k as DataHealthCheckId]}: ${v}`)
              .join("; "),
        },
      ]
    );

  const exportItems = () =>
    downloadCsv(
      `data-health-issues-${exportStamp()}`,
      categoryItems,
      [
        { header: "Check", value: (i) => CHECK_LABELS[i.checkId] },
        { header: "Tour", value: (i) => i.tourName },
        { header: "Departs", value: (i) => formatDateToDDMMYYYY(i.startDate) },
        { header: "Subject", value: (i) => i.subject },
        { header: "Detail", value: (i) => i.detail },
      ]
    );

  const summaryCards = [
    {
      label: "Ops readiness",
      value: data ? `${data.portfolioScore}` : "—",
      hint: "Average operational readiness across tours in scope",
      Icon: ShieldCheck,
    },
    {
      label: "Guest data",
      value: data ? `${data.guestPortfolioScore}` : "—",
      hint: "Completeness of passenger-supplied information",
      Icon: CheckCircle2,
    },
    {
      label: "Tours at risk",
      value: data?.atRisk ?? 0,
      hint: "Ops readiness below 70",
      Icon: TriangleAlert,
    },
    {
      label: "Tours to watch",
      value: data?.warning ?? 0,
      hint: "Ops readiness 70–89",
      Icon: ActivitySquare,
    },
  ];

  return (
    <div className="space-y-6">
      <AppBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Data Health" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Health &amp; Integrations</h1>
          <p className="text-muted-foreground">
            Operational readiness of upcoming tours (hotels, activities, tour setup), guest data completeness, and the
            live status of every connected system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v) as DataHealthWindow)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{isLoading ? "…" : c.value}</div>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tours" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tours">By tour</TabsTrigger>
          <TabsTrigger value="category">By check</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="tours" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search tours…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={exportTours} disabled={tours.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : tours.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No upcoming tours in this window.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tours.map((tour) => (
                <Collapsible key={tour.tourId} asChild>
                  <Card>
                    <CollapsibleTrigger className="w-full text-left">
                      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
                        <HealthScoreBadge score={tour.opsScore} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">{tour.tourName}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Departs {formatDateToDDMMYYYY(tour.startDate)}
                            {tour.daysOut !== null && ` · ${tour.daysOut} day(s) out`} · {tour.bookings} booking(s) ·{" "}
                            {tour.pax} pax
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[11px]">
                            Guest data {tour.guestScore}
                          </Badge>
                          {Object.entries(tour.byCheck).map(([key, count]) => (
                            <Badge key={key} variant="secondary" className="text-[11px]">
                              {CHECK_LABELS[key as DataHealthCheckId]} {count}
                            </Badge>
                          ))}
                          {tour.items.length === 0 && (
                            <Badge variant="outline" className="text-[11px]">
                              All clear
                            </Badge>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {DATA_HEALTH_CHECKS.filter((c) => tour.categoryScores[c.id] !== undefined).map((c) => (
                            <Badge key={c.id} variant="outline" className="text-[11px] font-normal">
                              <span className="text-muted-foreground">
                                {c.group === "ops" ? "Ops" : "Guest"} · {c.label}
                              </span>
                              <span className="ml-1 font-semibold tabular-nums">{tour.categoryScores[c.id]}</span>
                            </Badge>
                          ))}
                        </div>

                        {tour.items.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nothing outstanding — this tour is ready to run.
                          </p>
                        ) : (
                          <div className="space-y-6">
                            {(["ops", "guest"] as const).map((group) => {
                              const groupItems = group === "ops" ? tour.opsItems : tour.guestItems;
                              if (groupItems.length === 0) return null;
                              return (
                                <div key={group} className="space-y-2">
                                  <h4 className="text-sm font-semibold">
                                    {group === "ops"
                                      ? `Operational readiness (${groupItems.length})`
                                      : `Guest data completeness (${groupItems.length}) — does not affect the tour score`}
                                  </h4>
                                  <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Check</TableHead>
                                  <TableHead>Who / what</TableHead>
                                  <TableHead>Detail</TableHead>
                                  <TableHead className="text-right">Open</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupItems.map((item, idx) => (
                                  <TableRow key={`${item.checkId}-${idx}`}>
                                    <TableCell className="whitespace-nowrap text-xs">
                                      {CHECK_LABELS[item.checkId]}
                                    </TableCell>
                                    <TableCell className="text-sm">{item.subject}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{item.detail}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          navigate(item.bookingId ? `/bookings/${item.bookingId}` : `/tours/${item.tourId}`)
                                        }
                                      >
                                        Open
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {tour.acknowledged.length > 0 && (
                          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                            {tour.acknowledged.length} item(s) acknowledged and excluded from the score.
                          </div>
                        )}

                        <Button asChild variant="outline" size="sm">
                          <Link to={`/tours/${tour.tourId}`}>Open tour</Link>
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={(v) => setCategory(v as DataHealthCheckId | "all")}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All checks</SelectItem>
                {DATA_HEALTH_CHECKS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.group === "ops" ? "Ops" : "Guest"} · {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search tour, passenger or detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={exportItems} disabled={categoryItems.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Badge variant="secondary">{categoryItems.length} item(s)</Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : categoryItems.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Nothing outstanding for this check.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Check</TableHead>
                        <TableHead>Tour</TableHead>
                        <TableHead>Departs</TableHead>
                        <TableHead>Who / what</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryItems.map((item, idx) => (
                        <TableRow key={`${item.tourId}-${item.checkId}-${idx}`}>
                          <TableCell className="whitespace-nowrap text-xs">{CHECK_LABELS[item.checkId]}</TableCell>
                          <TableCell className="text-sm">{item.tourName}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateToDDMMYYYY(item.startDate)}
                          </TableCell>
                          <TableCell className="text-sm">{item.subject}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.detail}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(item.bookingId ? `/bookings/${item.bookingId}` : `/tours/${item.tourId}`)
                              }
                            >
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationStatusPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
