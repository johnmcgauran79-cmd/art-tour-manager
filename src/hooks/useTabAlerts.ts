import { useMemo } from "react";
import { TourAlert } from "./useTourAlerts";

export type TabType = "hotels" | "bookings" | "activities" | "overview";

const alertTypeToTabs: Record<string, TabType[]> = {
  hotel_oversold: ["hotels"],
  extra_nights: ["hotels", "bookings"],
  new_booking: ["hotels", "bookings"],
  booking_cancelled: ["hotels", "bookings"],
  activity_oversold: ["activities"],
  missing_info: ["overview"],
};

export const useTabAlerts = (alerts: TourAlert[], tabType: TabType) => {
  const tabAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const tabs = alertTypeToTabs[alert.alert_type] || [];
      return tabs.includes(tabType) && !alert.is_acknowledged;
    });
  }, [alerts, tabType]);
  
  return {
    count: tabAlerts.length,
    criticalCount: tabAlerts.filter(a => a.severity === 'critical').length,
  };
};
