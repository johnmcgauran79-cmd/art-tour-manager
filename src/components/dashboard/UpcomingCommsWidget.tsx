import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight, Calendar } from "lucide-react";
import { useUpcomingEmails } from "@/hooks/useUpcomingEmails";
import { format, parseISO } from "date-fns";

const statusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Awaiting approval":
      return "destructive";
    case "Approved":
      return "default";
    case "Forecast":
      return "secondary";
    default:
      return "outline";
  }
};

export const UpcomingCommsWidget = () => {
  const navigate = useNavigate();
  const { data: upcoming = [], isLoading } = useUpcomingEmails({
    daysAhead: 7,
    includeForecast: true,
  });

  const total = upcoming.length;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/40 rounded-t-xl transition-colors"
        onClick={() => navigate("/communications")}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" />
          Comms Due Next 7 Days
          {total > 0 && (
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          )}
          <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && total === 0 && (
          <p className="text-sm text-muted-foreground">No communications due in the next 7 days 🎉</p>
        )}
        {!isLoading &&
          upcoming.slice(0, 8).map((item) => (
            <button
              key={item.key}
              onClick={() => navigate("/communications")}
              className="w-full text-left p-2 rounded-md hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {item.templateName || item.ruleName || "Scheduled communication"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.tourName ? `${item.tourName} · ` : ""}
                    {item.recipientCount > 0
                      ? `${item.recipientCount} recipient${item.recipientCount === 1 ? "" : "s"}`
                      : "Forecast"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant={statusBadgeVariant(item.status)} className="text-[10px]">
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(item.dueAt.slice(0, 10)), "dd/MM/yyyy")}
                  </span>
                </div>
              </div>
            </button>
          ))}
      </CardContent>
    </Card>
  );
};
