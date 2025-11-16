import { useMemo } from "react";
import { useTourAlerts } from "./useTourAlerts";

export type TabType = "hotels" | "bookings" | "activities" | "overview";

const alertTypeToTabs: Record<string, TabType[]> = {
  hotel_oversold: ["hotels"],
  extra_nights: ["hotels", "bookings"],
  new_booking: ["bookings"],
  booking_cancelled: ["bookings"],
  activity_oversold: ["activities"],
  missing_info: ["overview"],
};

export const useTabAlerts = (tourId: string, tabType: TabType) => {
  const { alerts, isLoading } = useTourAlerts(tourId, false);
  
  const tabAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const tabs = alertTypeToTabs[alert.alert_type] || [];
      return tabs.includes(tabType) && !alert.is_acknowledged;
    });
  }, [alerts, tabType]);
  
  return {
    count: tabAlerts.length,
    criticalCount: tabAlerts.filter(a => a.severity === 'critical').length,
    isLoading,
  };
};
