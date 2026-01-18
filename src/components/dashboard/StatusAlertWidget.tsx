import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useFilterCounts } from "@/hooks/useBookings";

export const StatusAlertWidget = () => {
  const navigate = useNavigate();
  const { data: filterCounts, isLoading } = useFilterCounts();

  const depositsOwing = filterCounts?.depositsOwing || 0;
  const instalmentsOwing = filterCounts?.instalmentsOwing || 0;
  const paymentDue = filterCounts?.paymentDue || 0;
  const totalCount = depositsOwing + instalmentsOwing + paymentDue;

  const handleClick = () => {
    navigate('/bookings/bulk-status');
  };

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-brand-navy flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Booking Status Alerts
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
            No status alerts
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {depositsOwing > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm">Deposits Owing (7+ days)</span>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    {depositsOwing}
                  </Badge>
                </div>
              )}
              {instalmentsOwing > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm">Instalments Owing</span>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                    {instalmentsOwing}
                  </Badge>
                </div>
              )}
              {paymentDue > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm">Final Payments Owing</span>
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                    {paymentDue}
                  </Badge>
                </div>
              )}
            </div>
            
            <Button
              variant="ghost"
              className="w-full mt-2 text-brand-navy hover:text-brand-navy/80"
              onClick={handleClick}
            >
              Update Status
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
