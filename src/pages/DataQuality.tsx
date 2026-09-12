import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RefreshCw, Users, UserPlus, Receipt, Sparkles } from "lucide-react";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { HealthScoreBadge } from "@/components/datahealth/HealthScoreBadge";
import { DataQualityTable } from "@/components/dataquality/DataQualityTable";
import {
  AREA_LABELS,
  ISSUE_LABELS,
  useDataQuality,
  type DataQualityArea,
} from "@/hooks/useDataQuality";
import { downloadCsv, exportStamp } from "@/lib/csvExport";

const AREAS: { id: DataQualityArea; Icon: typeof Users; hint: string }[] = [
  { id: "contacts", Icon: Users, hint: "Duplicates, phone, email and location" },
  { id: "leads", Icon: UserPlus, hint: "Owner, tour, passengers, outcome and source" },
  { id: "finance", Icon: Receipt, hint: "Xero invoice links and references" },
];

export default function DataQuality() {
  const { data, isLoading, isFetching, refetch } = useDataQuality();
  const [area, setArea] = useState<DataQualityArea>("contacts");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [showDismissed, setShowDismissed] = useState(false);

  const areaIssues = useMemo(() => data?.byArea[area] ?? [], [data, area]);

  const types = useMemo(() => {
    const set = new Set(areaIssues.map((i) => i.issueType));
    return Array.from(set);
  }, [areaIssues]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return areaIssues.filter((i) => {
      if (!showDismissed && i.dismissed) return false;
      if (type !== "all" && i.issueType !== type) return false;
      if (!term) return true;
      return i.subject.toLowerCase().includes(term) || i.detail.toLowerCase().includes(term);
    });
  }, [areaIssues, search, type, showDismissed]);

  const exportCsv = () =>
    downloadCsv(`data-quality-${area}-${exportStamp()}`, visible, [
      { header: "Problem", value: (i) => ISSUE_LABELS[i.issueType] || i.issueType },
      { header: "Who / what", value: (i) => i.subject },
      { header: "Detail", value: (i) => i.detail },
      { header: "Not a problem", value: (i) => (i.dismissed ? "Yes" : "No") },
    ]);

  return (
    <div className="space-y-6">
      <AppBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Data Quality" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
          <p className="text-muted-foreground">
            Contact, enquiry and invoice problems that distort reports and AI answers — each with a link to fix it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{isLoading ? "…" : data?.overall}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? " "
                : `${(data?.counts.contacts ?? 0) + (data?.counts.leads ?? 0) + (data?.counts.finance ?? 0)} open item(s)`}
            </p>
          </CardContent>
        </Card>
        {AREAS.map(({ id, Icon, hint }) => (
          <Card
            key={id}
            className="cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => setArea(id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{AREA_LABELS[id]}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold tabular-nums">{isLoading ? "…" : data?.counts[id]}</div>
                {!isLoading && <HealthScoreBadge score={data?.scores[id] ?? 100} />}
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={area} onValueChange={(v) => { setArea(v as DataQualityArea); setType("all"); }} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {AREAS.map(({ id }) => (
            <TabsTrigger key={id} value={id}>
              {AREA_LABELS[id]}
              {!isLoading && (data?.counts[id] ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {data?.counts[id]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {AREAS.map(({ id }) => (
          <TabsContent key={id} value={id} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All problems</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ISSUE_LABELS[t] || t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search name or detail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Switch id="show-dismissed" checked={showDismissed} onCheckedChange={setShowDismissed} />
                <Label htmlFor="show-dismissed" className="text-sm text-muted-foreground">
                  Show items marked not a problem
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Badge variant="secondary">{visible.length} item(s)</Badge>
            </div>

            <Card>
              <CardContent className="p-0">
                {isLoading ? <Skeleton className="h-64 w-full" /> : <DataQualityTable issues={visible} />}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
