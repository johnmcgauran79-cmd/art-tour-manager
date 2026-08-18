import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, PlugZap } from "lucide-react";
import { useIntegrationHealth } from "@/hooks/useIntegrationHealth";

const toneFor = (state: string) =>
  state === "connected"
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
    : state === "degraded"
    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    : state === "disconnected"
    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
    : "bg-muted text-muted-foreground";

export const IntegrationStatusWidget = () => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useIntegrationHealth();
  const go = () => navigate("/?tab=settings&stab=system");
  const problems = data.filter((i) => i.state !== "connected").length;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="cursor-pointer rounded-t-xl pb-3 transition-colors hover:bg-muted/40" onClick={go}>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZap className="h-4 w-4 text-primary" />
          Integration Status
          {problems > 0 && <Badge variant="destructive" className="ml-1">{problems}</Badge>}
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-1 overflow-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data.map((integration) => (
          <button
            key={integration.id}
            onClick={go}
            className="w-full rounded-md p-2 text-left transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{integration.name}</span>
              <Badge variant="outline" className={toneFor(integration.state)}>
                {integration.state}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{integration.headline}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
