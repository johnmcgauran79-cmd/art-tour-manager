import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TourMarketingWindow {
  from: string;
  to: string;
  emailed_contacts: number;
  sends: number;
  opened_contacts: number;
  clicked_contacts: number;
  meaningful_click_contacts: number;
  meaningful_click_events: number;
  register_interest_click_events: number;
  enquiries: number;
  prospective_passengers: number;
  bookings: number;
  booked_passengers: number;
  booked_value: number;
}

export interface TourMarketingAudience {
  interested_contacts: number;
  marketing_eligible_interested: number;
  active_leads: number;
  nurture_leads: number;
  booked_contacts: number;
  booked_passengers: number;
  interested_not_booked: number;
  interested_not_booked_eligible: number;
}

export interface TourMarketingCampaign {
  campaign_id: string;
  name: string | null;
  subject: string | null;
  status: string | null;
  send_started_at: string | null;
  sent: number;
  opened: number;
  clicked: number;
  high_intent_clickers: number;
}

export interface TourMarketingIntelligence {
  tour_id: string;
  days: number;
  tracking_since: string | null;
  audience: TourMarketingAudience;
  campaigns: TourMarketingCampaign[];
  current: TourMarketingWindow;
  previous: TourMarketingWindow;
  all_time: Omit<TourMarketingWindow, "from" | "to" | "meaningful_click_events" | "register_interest_click_events">;
}

/**
 * Per-tour marketing and CRM intelligence. Every figure comes from existing
 * booking, enquiry and campaign-tracking records — nothing is estimated.
 */
export function useTourMarketingIntelligence(tourId?: string, days = 30) {
  return useQuery({
    queryKey: ["tour-marketing-intelligence", tourId, days],
    enabled: !!tourId,
    queryFn: async (): Promise<TourMarketingIntelligence> => {
      const { data, error } = await supabase.rpc("crm_tour_marketing_intelligence" as any, {
        _tour_id: tourId,
        _days: days,
      });
      if (error) throw error;
      return data as unknown as TourMarketingIntelligence;
    },
  });
}

export type TourMarketingMetric =
  | "interested"
  | "interested_not_booked"
  | "nurture_leads"
  | "active_leads"
  | "emailed"
  | "opened"
  | "clicked"
  | "meaningful_clicks"
  | "enquiries"
  | "bookings";

export interface TourMarketingPerson {
  customer_id: string | null;
  name: string | null;
  email: string | null;
  detail: string | null;
  occurred_at: string | null;
}

/** The actual contacts behind one of the headline numbers. */
export function useTourMarketingPeople(
  tourId?: string,
  metric?: TourMarketingMetric,
  days = 30
) {
  return useQuery({
    queryKey: ["tour-marketing-people", tourId, metric, days],
    enabled: !!tourId && !!metric,
    queryFn: async (): Promise<TourMarketingPerson[]> => {
      const { data, error } = await supabase.rpc("crm_tour_marketing_people" as any, {
        _tour_id: tourId,
        _metric: metric,
        _days: days,
      });
      if (error) throw error;
      return (data || []) as unknown as TourMarketingPerson[];
    },
  });
}
