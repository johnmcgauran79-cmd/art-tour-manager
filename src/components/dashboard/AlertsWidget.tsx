import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, ArrowRight, AlertTriangle, Info, AlertCircle, Check } from "lucide-react";
import { useGlobalTourAlerts } from "@/hooks/useGlobalTourAlerts";
import { GlobalTourAlertsModal } from "@/components/GlobalTourAlertsModal";
import { useTourAlerts } from "@/hooks/useTourAlerts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const severityConfig = {
  info: {
    icon: Info,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50",
  },
};

const alertTypeLabels: Record<string, string> = {
  new_booking: "New Booking",
  booking_cancelled: "Cancelled",
  activity_oversold: "Activity Oversold",
  hotel_oversold: "Hotel Oversold",
  capacity_warning: "Capacity Warning",
};

export const AlertsWidget = () => {
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const { alerts, isLoading, unacknowledgedCount, refetch } = useGlobalTourAlerts(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("tour_alerts")
      .update({
        is_acknowledged: true,
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive",
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ["global-tour-alerts"] });
      toast({
        title: "Alert acknowledged",
        description: "The alert has been dismissed",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Operations Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Take most recent 10 unacknowledged alerts
  const recentAlerts = (alerts || [])
    .filter(alert => !alert.is_acknowledged)
    .slice(0, 10);

  return (
    <>
      <div className="w-full md:w-1/3">
        <Card className="border-brand-navy/20 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-brand-navy flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Operations Alerts
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {unacknowledgedCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentAlerts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No active alerts
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {recentAlerts.map((alert) => {
                    const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-md transition-colors",
                          config.bgColor
                        )}
                      >
                        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-14 flex-shrink-0">
                              {format(new Date(alert.created_at), 'd-MMM')}
                            </span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {alertTypeLabels[alert.alert_type] || alert.alert_type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 ml-auto flex-shrink-0 hover:bg-green-100"
                              onClick={(e) => handleAcknowledge(alert.id, e)}
                              title="Acknowledge alert"
                            >
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                          </div>
                          <p className="text-sm font-medium truncate mt-0.5">
                            {alert.message}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {alert.tours?.name || 'Unknown Tour'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-brand-navy hover:text-brand-navy/80"
                  onClick={() => setAlertsModalOpen(true)}
                >
                  View All Alerts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <GlobalTourAlertsModal 
        open={alertsModalOpen} 
        onOpenChange={setAlertsModalOpen} 
      />
    </>
  );
};
