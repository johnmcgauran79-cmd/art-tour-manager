import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, AlertTriangle, Info, Check, X } from "lucide-react";
import { useGlobalTourAlerts } from "@/hooks/useGlobalTourAlerts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GlobalTourAlertsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-600",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-600",
    label: "Info",
  },
};

const alertTypeLabels: Record<string, string> = {
  activity_oversold: "Activity Oversold",
  hotel_oversold: "Hotel Oversold",
  new_booking: "New Booking",
  booking_cancelled: "Booking Cancelled",
  extra_nights: "Extra Nights",
  missing_info: "Missing Information",
};

const alertTypeToTab: Record<string, string> = {
  activity_oversold: "activities",
  hotel_oversold: "hotels",
  new_booking: "bookings",
  booking_cancelled: "bookings",
  extra_nights: "hotels",
  missing_info: "overview",
};

export const GlobalTourAlertsModal = ({ open, onOpenChange }: GlobalTourAlertsModalProps) => {
  const [showResolved, setShowResolved] = useState(false);
  const { alerts, isLoading, unacknowledgedCount, refetch } = useGlobalTourAlerts(showResolved);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAcknowledge = async (alert: any) => {
    try {
      const { error } = await supabase
        .from('tour_alerts')
        .update({ 
          is_acknowledged: true, 
          acknowledged_by: (await supabase.auth.getUser()).data.user?.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alert.id);

      if (error) throw error;

      toast({
        title: "Alert acknowledged",
        description: "The alert has been marked as acknowledged.",
      });
      
      refetch();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge alert.",
        variant: "destructive",
      });
    }
  };

  const handleAlertClick = (alert: any) => {
    const tab = alertTypeToTab[alert.alert_type] || "overview";
    navigate(`/tours/${alert.tour_id}?tab=${tab}`);
    onOpenChange(false);
  };

  const renderAlert = (alert: any) => {
    const config = severityConfig[alert.severity as keyof typeof severityConfig];
    const Icon = config.icon;

    return (
      <div
        key={alert.id}
        className={cn(
          "p-4 rounded-lg border-l-4 space-y-3 cursor-pointer hover:bg-accent/5 transition-colors",
          config.bgColor,
          config.borderColor,
          alert.is_acknowledged && "opacity-60"
        )}
        onClick={() => handleAlertClick(alert)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-normal">
                  {alertTypeLabels[alert.alert_type] || alert.alert_type}
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  {alert.tours?.name || 'Unknown Tour'}
                </Badge>
                {alert.is_acknowledged && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Acknowledged
                  </Badge>
                )}
              </div>
              <p className="font-medium">{alert.message}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(alert.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </div>
          </div>
          
          {!alert.is_acknowledged && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAcknowledge(alert);
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            All Tour Alerts
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive">{unacknowledgedCount}</Badge>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="show-resolved"
              checked={showResolved}
              onCheckedChange={(checked) => setShowResolved(checked as boolean)}
            />
            <label
              htmlFor="show-resolved"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show resolved
            </label>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {showResolved ? "No alerts found" : "No unacknowledged alerts"}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {alerts.map((alert) => renderAlert(alert))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
