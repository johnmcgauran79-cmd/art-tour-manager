import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles } from "lucide-react";
import { HealthScoreBadge } from "@/components/datahealth/HealthScoreBadge";
import { AREA_LABELS, useDataQualitySummary, type DataQualityArea } from "@/hooks/useDataQuality";

const AREAS: DataQualityArea[] = ["contacts", "leads", "finance"];

export const DataQualityWidget = () => {
  const navigate = useNavigate();
  const { isLoading, overall, counts, openIssues } = useDataQualitySummary();
  const go = () => navigate("/data-quality");

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="cursor-pointer rounded-t-xl pb-3 transition-colors hover:bg-muted/40" onClick={go}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Data Quality
          {!isLoading && <HealthScoreBadge score={overall} className="ml-1" />}
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {openIssues} item(s) to tidy up across contacts, enquiries and invoices
          </p>
        )}
        {!isLoading &&
          AREAS.map((area) => (
            <button
              key={area}
              onClick={go}
              className="flex w-full items-center justify-between gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/60"
            >
              <span className="text-sm font-medium">{AREA_LABELS[area]}</span>
              <Badge variant={counts[area] > 0 ? "secondary" : "outline"}>{counts[area]}</Badge>
            </button>
          ))}
      </CardContent>
    </Card>
  );
};
