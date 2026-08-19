import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, AlertTriangle, Info, Check, X, Bell, XCircle } from "lucide-react";
import { useTourAlerts, TourAlert } from "@/hooks/useTourAlerts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TourAlertsModalProps {
  tourId: string;
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

export const TourAlertsModal = ({ tourId, open, onOpenChange }: TourAlertsModalProps) => {
  const [showResolved, setShowResolved] = useState(false);
  const { alerts, isLoading, acknowledgeAlert, deleteAlert, unacknowledgedCount } = useTourAlerts(tourId, showResolved);

  const groupedAlerts = {
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info'),
  };

  const renderAlert = (alert: TourAlert) => {
    const config = severityConfig[alert.severity];
    const Icon = config.icon;

    return (
      <div
        key={alert.id}
        className={cn(
          "p-4 rounded-lg border-l-4 space-y-3",
          config.bgColor,
          config.borderColor,
          alert.is_acknowledged && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {alertTypeLabels[alert.alert_type] || alert.alert_type}
                </Badge>
                {alert.is_acknowledged && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Acknowledged
                  </Badge>
                )}
              </div>
              <p className="font-medium">{alert.message}</p>
              {alert.details && Object.keys(alert.details).length > 0 && (
                <div className="text-sm text-muted-foreground space-y-1">
                  {alert.details.spots_available !== undefined && (
                    <p>Available: {alert.details.spots_available} | Booked: {alert.details.spots_booked} | Oversold by: {alert.details.oversold_by}</p>
                  )}
                  {alert.details.rooms_reserved !== undefined && (
                    <p>Reserved: {alert.details.rooms_reserved} | Booked: {alert.details.rooms_booked} | Oversold by: {alert.details.oversold_by}</p>
                  )}
                  {alert.details.passenger_count !== undefined && (
                    <p>Passengers: {alert.details.passenger_count} | Status: {alert.details.status}</p>
                  )}
                  {alert.details.check_in_date && (
                    <p>Check-in: {format(new Date(alert.details.check_in_date), 'dd/MM/yyyy')} | Check-out: {format(new Date(alert.details.check_out_date), 'dd/MM/yyyy')}</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!alert.is_acknowledged && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => acknowledgeAlert(alert.id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Acknowledge
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteAlert(alert.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Tour Alerts
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledgedCount} Active
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="show-resolved"
            checked={showResolved}
            onCheckedChange={(checked) => setShowResolved(checked as boolean)}
          />
          <label
            htmlFor="show-resolved"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show Resolved Alerts
          </label>
        </div>
        
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No alerts for this tour</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {groupedAlerts.critical.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Critical ({groupedAlerts.critical.length})
                  </h3>
                  {groupedAlerts.critical.map(renderAlert)}
                </div>
              )}

              {groupedAlerts.warning.length > 0 && (
                <>
                  {groupedAlerts.critical.length > 0 && <Separator />}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-yellow-600 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Warnings ({groupedAlerts.warning.length})
                    </h3>
                    {groupedAlerts.warning.map(renderAlert)}
                  </div>
                </>
              )}

              {groupedAlerts.info.length > 0 && (
                <>
                  {(groupedAlerts.critical.length > 0 || groupedAlerts.warning.length > 0) && <Separator />}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-blue-600 flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Information ({groupedAlerts.info.length})
                    </h3>
                    {groupedAlerts.info.map(renderAlert)}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
