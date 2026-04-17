import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight, Calendar, Zap } from "lucide-react";
import { usePendingEmailApprovals } from "@/hooks/usePendingEmailApprovals";
import { usePendingStatusChangeApprovals } from "@/hooks/useStatusChangeEmailQueue";
import { format } from "date-fns";

interface UnifiedRow {
  key: string;
  source: 'scheduled' | 'status_change';
  title: string;
  ruleName: string;
  date?: string;
}

export const PendingEmailApprovalsWidget = () => {
  const navigate = useNavigate();
  const { data: scheduledApprovals, isLoading: loadingScheduled } = usePendingEmailApprovals();
  const { data: statusChangeBatches, isLoading: loadingStatus } = usePendingStatusChangeApprovals();

  const isLoading = loadingScheduled || loadingStatus;

  const scheduledRows: UnifiedRow[] = (scheduledApprovals || []).map((a) => ({
    key: `sched-${a.id}`,
    source: 'scheduled',
    title: a.tour?.name || 'Unknown Tour',
    ruleName: a.rule?.rule_name || 'Email',
    date: a.tour?.start_date,
  }));

  const statusChangeRows: UnifiedRow[] = (statusChangeBatches || []).map((b) => ({
    key: `sc-${b.rule_id}-${b.batch_date}`,
    source: 'status_change',
    title: `${b.items.length} booking${b.items.length !== 1 ? 's' : ''}`,
    ruleName: b.rule_name,
    date: b.batch_date,
  }));

  const allRows = [...scheduledRows, ...statusChangeRows];
  const totalCount =
    (scheduledApprovals?.length || 0) +
    (statusChangeBatches?.reduce((sum, b) => sum + b.items.length, 0) || 0);

  const handleClick = () => {
    navigate('/?tab=bookings&section=approvals');
  };

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-brand-navy flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Approvals
          {totalCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        ) : allRows.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No pending approvals
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allRows.slice(0, 5).map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col p-2 rounded-md bg-muted/50 text-sm gap-1"
                >
                  <span className="font-medium truncate">{row.title}</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        row.source === 'scheduled'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 text-xs'
                          : 'bg-amber-100 text-amber-800 border-amber-300 text-xs'
                      }
                    >
                      {row.source === 'scheduled' ? (
                        <><Calendar className="h-3 w-3 mr-1" />Scheduled</>
                      ) : (
                        <><Zap className="h-3 w-3 mr-1" />Status Change</>
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {row.ruleName}
                    </span>
                  </div>
                  {row.date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(row.date), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
              ))}
              {allRows.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{allRows.length - 5} more pending
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              className="w-full mt-2 text-brand-navy hover:text-brand-navy/80"
              onClick={handleClick}
            >
              View Approvals
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
