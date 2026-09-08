import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CampaignAttribution {
  campaign_id: string;
  name: string | null;
  subject: string | null;
  status: string | null;
  send_started_at: string | null;
  send_completed_at: string | null;
  recipients: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  high_intent_clickers: number;
  attributed_enquiries: number;
  prospective_passengers: number;
  attributed_bookings: number;
  booked_passengers: number;
  booked_value: number;
  open_rate: number | null;
  click_rate: number | null;
}

/** Per-campaign results: delivery, engagement and the enquiries/bookings that followed. */
export function useCampaignAttribution() {
  return useQuery({
    queryKey: ["crm-campaign-attribution"],
    queryFn: async (): Promise<CampaignAttribution[]> => {
      const { data, error } = await supabase
        .from("crm_campaign_attribution" as any)
        .select("*")
        .order("send_started_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as CampaignAttribution[];
    },
  });
}

export interface MarketingSignal {
  event_id: string;
  campaign_id: string | null;
  recipient_id: string | null;
  occurred_at: string;
  event_type: string;
  link_url: string | null;
  intent: string | null;
  intent_label: string | null;
  intent_tour_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  lead_stage: string | null;
  contact_name?: string;
  campaign_name?: string;
}

/** Recent meaningful clicks, with the contact and campaign names filled in. */
export function useMarketingSignals(onlyHighIntent = true, limit = 100) {
  return useQuery({
    queryKey: ["crm-marketing-signals", onlyHighIntent, limit],
    queryFn: async (): Promise<MarketingSignal[]> => {
      let q = supabase
        .from("crm_lead_marketing_signals" as any)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (onlyHighIntent) q = q.eq("intent", "high_intent");
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as unknown as MarketingSignal[];

      const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
      const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))] as string[];

      const [{ data: customers }, { data: campaigns }] = await Promise.all([
        customerIds.length
          ? supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
          : Promise.resolve({ data: [] as any[] }),
        campaignIds.length
          ? supabase.from("marketing_campaigns").select("id, name").in("id", campaignIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const nameById = new Map(
        (customers || []).map((c: any) => [
          c.id,
          `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown contact",
        ])
      );
      const campaignById = new Map((campaigns || []).map((c: any) => [c.id, c.name]));

      return rows.map((r) => ({
        ...r,
        contact_name: r.customer_id ? nameById.get(r.customer_id) : undefined,
        campaign_name: r.campaign_id ? campaignById.get(r.campaign_id) : undefined,
      }));
    },
  });
}

export interface LinkClassification {
  id: string;
  url_pattern: string;
  intent: string;
  label: string | null;
  tour_id: string | null;
  is_active: boolean;
}

export function useLinkClassifications() {
  return useQuery({
    queryKey: ["marketing-link-classifications"],
    queryFn: async (): Promise<LinkClassification[]> => {
      const { data, error } = await supabase
        .from("marketing_link_classifications" as any)
        .select("*")
        .order("intent")
        .order("url_pattern");
      if (error) throw error;
      return (data || []) as unknown as LinkClassification[];
    },
  });
}

export function useSaveLinkClassification() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: Partial<LinkClassification>) => {
      const payload = {
        url_pattern: row.url_pattern?.trim(),
        intent: row.intent,
        label: row.label || null,
        tour_id: row.tour_id || null,
        is_active: row.is_active ?? true,
        ...(row.id ? { id: row.id } : {}),
      };
      const { error } = await supabase
        .from("marketing_link_classifications" as any)
        .upsert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-link-classifications"] });
      qc.invalidateQueries({ queryKey: ["crm-marketing-signals"] });
      qc.invalidateQueries({ queryKey: ["crm-campaign-attribution"] });
      toast({ title: "Link rule saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save link rule", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteLinkClassification() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_link_classifications" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-link-classifications"] });
      toast({ title: "Link rule removed" });
    },
    onError: (e: any) =>
      toast({ title: "Could not remove link rule", description: e.message, variant: "destructive" }),
  });
}
