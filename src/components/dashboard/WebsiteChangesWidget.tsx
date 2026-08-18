import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Globe } from "lucide-react";
import { format, parseISO } from "date-fns";
import { WEBSITE_SECTION_LABELS, useWebsiteChangeGroups } from "@/hooks/useWebsiteChanges";

export const WebsiteChangesWidget = () => {
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useWebsiteChangeGroups();
  const total = groups.reduce((sum, g) => sum + g.totalChanges, 0);
  const go = () => navigate("/communications?tab=website");

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
        onClick={go}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          Approve Website Changes
          {total > 0 && (
            <Badge variant="destructive" className="ml-1">
              {total}
            </Badge>
          )}
          <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No website changes waiting for approval 🎉
          </p>
        )}
        {!isLoading &&
          groups.slice(0, 8).map((group) => (
            <button
              key={group.tourId}
              onClick={go}
              className="w-full text-left p-2 rounded-md hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{group.tourName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.requests.map((r) => WEBSITE_SECTION_LABELS[r.section]).join(", ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary">{group.totalChanges}</Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(parseISO(group.lastChangedAt), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            </button>
          ))}
      </CardContent>
    </Card>
  );
};