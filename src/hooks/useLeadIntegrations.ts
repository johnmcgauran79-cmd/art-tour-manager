import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Phase 4 external lead sources (Facebook/Meta, Zapier, partners, other APIs).
 * These records only hold configuration — the enquiries themselves go through
 * the same submission + intake pipeline as the ART website forms.
 */

const db = supabase as any;

export interface LeadIntegration {
  id: string;
  key: string;
  name: string;
  provider: string;
  partner_name: string | null;
  description: string | null;
  is_enabled: boolean;
  token_prefix: string | null;
  token_hash: string | null;
  token_rotated_at: string | null;
  token_last_used_at: string | null;
  form_type: string;
  lead_type: string | null;
  lead_source: string | null;
  medium: string | null;
  source_channel: string;
  lead_owner_id: string | null;
  default_priority: string;
  followup_due_days: number;
  ack_enabled: boolean;
  ack_template_id: string | null;
  notify_teams: boolean;
  auto_tag_ids: string[];
  task_assignee_ids: string[];
  task_watcher_ids: string[];
  default_tour_id: string | null;
  allow_consent: boolean;
  last_submission_at: string | null;
  success_count: number;
  failed_count: number;
  created_at: string;
}

export interface TourMapping {
  id: string;
  integration_id: string | null;
  external_key: string;
  external_label: string | null;
  tour_id: string | null;
  created_at: string;
  tour?: { id: string; name: string } | null;
}

export const PROVIDERS = [
  { value: "meta", label: "Facebook / Instagram lead ads", channel: "meta" },
  { value: "zapier", label: "Zapier", channel: "zapier" },
  { value: "partner", label: "Partner organisation", channel: "partner" },
  { value: "generic", label: "Other system (API)", channel: "api" },
];

export const useLeadIntegrations = () =>
  useQuery({
    queryKey: ["lead-integrations"],
    queryFn: async () => {
      const { data, error } = await db
        .from("lead_integrations")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as LeadIntegration[];
    },
  });

/** Live counts per source, taken from the stored submissions themselves. */
export const useLeadIntegrationStats = () =>
  useQuery({
    queryKey: ["lead-integration-stats"],
    queryFn: async () => {
      const { data, error } = await db
        .from("landing_page_submissions")
        .select("integration_id, processing_status, needs_review, created_at")
        .not("integration_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const out: Record<
        string,
        { total: number; processed: number; failed: number; review: number; last: string | null }
      > = {};
      for (const r of data || []) {
        const s = (out[r.integration_id] ||= {
          total: 0,
          processed: 0,
          failed: 0,
          review: 0,
          last: null,
        });
        s.total += 1;
        if (r.processing_status === "processed") s.processed += 1;
        else s.failed += 1;
        if (r.needs_review) s.review += 1;
        if (!s.last) s.last = r.created_at;
      }
      return out;
    },
    staleTime: 30_000,
  });

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["lead-integrations"] });
  qc.invalidateQueries({ queryKey: ["lead-integration-stats"] });
};

export const useSaveLeadIntegration = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: Partial<LeadIntegration> & { id?: string }) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await db.from("lead_integrations").update(rest).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("lead_integrations")
        .insert({ ...rest, created_by: user?.user?.id || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: "Lead source saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteLeadIntegration = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("lead_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: "Lead source removed" });
    },
    onError: (e: any) =>
      toast({ title: "Could not remove", description: e.message, variant: "destructive" }),
  });
};

/** Creates or replaces the API key. The key itself is only shown once. */
export const useRotateIntegrationKey = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { integrationId: string; action?: "rotate" | "revoke" }) => {
      const { data, error } = await supabase.functions.invoke("lead-integration-keys", {
        body: { integration_id: vars.integrationId, action: vars.action || "rotate" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { api_key?: string; prefix?: string; revoked?: boolean };
    },
    onSuccess: (data) => {
      invalidate(qc);
      toast({ title: data?.revoked ? "Key revoked" : "New key created" });
    },
    onError: (e: any) =>
      toast({ title: "Could not update the key", description: e.message, variant: "destructive" }),
  });
};

/* ------------------------------------------------------------ tour mapping */

export const useTourMappings = (integrationId?: string | null) =>
  useQuery({
    queryKey: ["lead-tour-mappings", integrationId || "all"],
    queryFn: async () => {
      let q = db
        .from("lead_integration_tour_map")
        .select("*, tour:tours(id, name)")
        .order("created_at", { ascending: false });
      if (integrationId) q = q.or(`integration_id.eq.${integrationId},integration_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TourMapping[];
    },
  });

export const useSaveTourMapping = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: {
      integration_id?: string | null;
      external_key: string;
      external_label?: string | null;
      tour_id: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const key = vars.external_key.trim();
      /* Matching ignores capitalisation, so look for an existing row first
         rather than relying on a database conflict rule. */
      let find = db
        .from("lead_integration_tour_map")
        .select("id")
        .ilike("external_key", key);
      find = vars.integration_id
        ? find.eq("integration_id", vars.integration_id)
        : find.is("integration_id", null);
      const { data: existing } = await find.maybeSingle();

      const row = {
        integration_id: vars.integration_id || null,
        external_key: key,
        external_label: vars.external_label || key,
        tour_id: vars.tour_id,
        created_by: user?.user?.id || null,
      };
      const { error } = existing?.id
        ? await db.from("lead_integration_tour_map").update(row).eq("id", existing.id)
        : await db.from("lead_integration_tour_map").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-tour-mappings"] });
      toast({ title: "Tour mapping saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save the mapping", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteTourMapping = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("lead_integration_tour_map").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-tour-mappings"] });
      toast({ title: "Mapping removed" });
    },
    onError: (e: any) =>
      toast({ title: "Could not remove", description: e.message, variant: "destructive" }),
  });
};
