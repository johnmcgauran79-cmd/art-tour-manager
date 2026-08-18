import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, HelpCircle, PlugZap, XCircle } from "lucide-react";
import { useIntegrationHealth, type IntegrationState } from "@/hooks/useIntegrationHealth";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const stateMeta: Record<IntegrationState, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  connected: {
    label: "Connected",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Needs attention",
    className: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
    Icon: AlertTriangle,
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200",
    Icon: XCircle,
  },
  unknown: {
    label: "Unknown",
    className: "bg-muted text-muted-foreground border-border",
    Icon: HelpCircle,
  },
};

const formatWhen = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${formatDateToDDMMYYYY(iso)} ${d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`;
};

export const IntegrationStatusPanel = () => {
  const { data = [], isLoading } = useIntegrationHealth();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((integration) => {
        const meta = stateMeta[integration.state];
        return (
          <Card key={integration.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PlugZap className="h-4 w-4 text-muted-foreground" />
                  {integration.name}
                </CardTitle>
                <Badge variant="outline" className={meta.className}>
                  <meta.Icon className="mr-1 h-3 w-3" />
                  {meta.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{integration.headline}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {integration.metrics.map((m) => (
                  <div key={m.label} className="rounded-md border bg-muted/40 p-2">
                    <dt className="text-muted-foreground">{m.label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="text-xs text-muted-foreground">
                Last activity: {formatWhen(integration.lastActivityAt)}
              </div>
              {integration.lastError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  {integration.lastError}
                </p>
              )}
              {integration.fixLink && (
                <Button asChild variant="outline" size="sm">
                  <Link to={integration.fixLink.to}>{integration.fixLink.label}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
