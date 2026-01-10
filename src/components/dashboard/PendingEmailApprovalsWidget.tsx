import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight } from "lucide-react";
import { usePendingEmailApprovals } from "@/hooks/usePendingEmailApprovals";
import { format } from "date-fns";

export const PendingEmailApprovalsWidget = () => {
  const navigate = useNavigate();
  const { data: pendingApprovals, isLoading } = usePendingEmailApprovals();

  const totalCount = pendingApprovals?.length || 0;

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
        ) : totalCount === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No pending approvals
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingApprovals?.slice(0, 5).map((approval) => (
                <div 
                  key={approval.id} 
                  className="flex flex-col p-2 rounded-md bg-muted/50 text-sm gap-1"
                >
                  <span className="font-medium truncate">
                    {approval.tour?.name || 'Unknown Tour'}
                  </span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs w-fit">
                    {approval.rule?.rule_name || 'Email'}
                  </Badge>
                  {approval.tour?.start_date && (
                    <span className="text-xs text-muted-foreground">
                      Tour: {format(new Date(approval.tour.start_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              ))}
              {totalCount > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{totalCount - 5} more pending
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
