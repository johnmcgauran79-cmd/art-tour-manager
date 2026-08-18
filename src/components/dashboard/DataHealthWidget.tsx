import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { HealthScoreBadge } from "@/components/datahealth/HealthScoreBadge";
import { useDataHealthSummary } from "@/hooks/useDataHealth";

export const DataHealthWidget = () => {
  const navigate = useNavigate();
  const { isLoading, score, atRisk, openIssues, worst } = useDataHealthSummary();
  const go = () => navigate("/data-health");

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="cursor-pointer rounded-t-xl pb-3 transition-colors hover:bg-muted/40" onClick={go}>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Data Health
          {!isLoading && <HealthScoreBadge score={score} className="ml-1" />}
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {openIssues} open issue(s) across tours departing in the next 60 days
            {atRisk > 0 && ` · ${atRisk} tour(s) at risk`}
          </p>
        )}
        {!isLoading &&
          worst.map((tour) => (
            <button
              key={tour.tourId}
              onClick={go}
              className="w-full rounded-md p-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{tour.tourName}</span>
                <Badge variant="secondary" className="shrink-0">
                  {tour.items.length}
                </Badge>
                <HealthScoreBadge score={tour.score} />
              </div>
            </button>
          ))}
        {!isLoading && worst.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming tours to check 🎉</p>
        )}
      </CardContent>
    </Card>
  );
};
