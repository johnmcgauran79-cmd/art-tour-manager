import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Sales safeguards, automation and reporting.
 *
 * Every number comes from the database so that the action list, the pipeline,
 * a single enquiry and management reporting all count the same way. Nothing here
 * duplicates the task manager, the email marketing system or booking values.
 */

const db = supabase as any;

/** One enquiry with everything derived: age, stage time, response, safeguards. */
export interface LeadFact {
  id: string;
  customer_id: string;
  tour_id: string | null;
  owner_id: string | null;
  stage: string;
  stage_label: string | null;
  stage_order: number | null;
  stage_open: boolean;
  stage_won: boolean;
  stage_lost: boolean;
  stage_active: boolean;
  stage_exempt: boolean;
  stale_after_days: number | null;
  priority: string | null;
  lead_type: string | null;
  source: string | null;
  source_channel: string | null;
  campaign: string | null;
  platform: string | null;
  partner: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tour_name: string | null;
  tour_start_date: string | null;
  created_at: string;
  converted_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  next_task_due: string | null;
  open_future_tasks: number;
  prospective_passengers: number | null;
  passengers_unknown: boolean;
  last_meaningful_at: string | null;
  first_outbound_at: string | null;
  last_inbound_at: string | null;
  meaningful_count: number;
  stage_entered_at: string;
  business_days_in_stage: number;
  lead_age_days: number;
  lead_age_business_days: number;
  first_response_hours: number | null;
  no_next_action: boolean;
  next_action_overdue: boolean;
  is_stale: boolean;
  awaiting_first_response: boolean;
  client_replied: boolean;
  nurture_review_date: string | null;
  booking_id: string | null;
  booking_status: string | null;
  booked_passengers: number | null;
  booking_revenue: number | null;
  value_credited_here: boolean | null;
  attributed_revenue: number | null;
}

export interface ActionBoard {
  new_leads: LeadFact[];
  uncontacted: LeadFact[];
  due_today: LeadFact[];
  overdue: LeadFact[];
  no_next_action: LeadFact[];
  stale: LeadFact[];
  client_replies: LeadFact[];
  booking_enquiries: LeadFact[];
  high_priority: LeadFact[];
  nurture_due: LeadFact[];
  generated_at: string;
}

const rpc = async <T,>(name: string, params: Record<string, unknown> = {}) => {
  const { data, error } = await db.rpc(name, params);
  if (error) throw error;
  return data as T;
};

export const useActionBoard = () =>
  useQuery({
    queryKey: ["crm-action-board"],
    queryFn: () => rpc<ActionBoard>("crm_action_board"),
    staleTime: 60_000,
  });

/** Derived measures for every enquiry, keyed by enquiry id. */
export const useLeadFactsMap = () =>
  useQuery({
    queryKey: ["crm-lead-facts"],
    queryFn: async () => {
      const { data, error } = await db.from("crm_lead_facts").select("*").limit(5000);
      if (error) throw error;
      const map = new Map<string, LeadFact>();
      for (const row of (data || []) as LeadFact[]) map.set(row.id, row);
      return map;
    },
    staleTime: 60_000,
  });

export const useLeadFact = (id?: string | null) =>
  useQuery({
    queryKey: ["crm-lead-fact", id],
    queryFn: async () => {
      const { data, error } = await db.from("crm_lead_facts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as LeadFact | null;
    },
    enabled: !!id,
  });

export interface ReportRange {
  from?: string | null;
  to?: string | null;
}

const rangeParams = (r: ReportRange) => ({ _from: r.from || null, _to: r.to || null });

export const usePipelineSummary = (range: ReportRange) =>
  useQuery({
    queryKey: ["crm-pipeline-summary", range],
    queryFn: () => rpc<any>("crm_pipeline_summary", rangeParams(range)),
    staleTime: 60_000,
  });

export const useFunnel = (range: ReportRange, tourId?: string | null) =>
  useQuery({
    queryKey: ["crm-funnel", range, tourId],
    queryFn: () => rpc<any>("crm_funnel", { ...rangeParams(range), _tour_id: tourId || null }),
    staleTime: 60_000,
  });

export const useResponsePerformance = (range: ReportRange) =>
  useQuery({
    queryKey: ["crm-response", range],
    queryFn: () => rpc<any>("crm_response_performance", rangeParams(range)),
    staleTime: 60_000,
  });

export const useTourSales = (range: ReportRange, includePast = false) =>
  useQuery({
    queryKey: ["crm-tour-sales", range, includePast],
    queryFn: () => rpc<any[]>("crm_tour_sales", { ...rangeParams(range), _include_past: includePast }),
    staleTime: 60_000,
  });

export const useAttributionPerformance = (range: ReportRange) =>
  useQuery({
    queryKey: ["crm-attribution", range],
    queryFn: () => rpc<any>("crm_attribution_performance", rangeParams(range)),
    staleTime: 60_000,
  });

export const useCrmDataQuality = () =>
  useQuery({
    queryKey: ["crm-data-quality"],
    queryFn: () => rpc<any>("crm_data_quality"),
    staleTime: 5 * 60_000,
  });

/* ------------------------------ Sales settings ----------------------------- */

export interface CrmSettings {
  first_response_target_hours: number;
  first_response_basis: string;
  owner_warning_days: number;
  manager_escalation_days: number;
  crm_era_start: string;
}

export const useCrmSettings = () =>
  useQuery({
    queryKey: ["crm-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("crm_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as CrmSettings;
    },
    staleTime: 5 * 60_000,
  });

export const useUpdateCrmSettings = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: Partial<CrmSettings>) => {
      const { error } = await db.from("crm_settings").update(values).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-settings"] });
      qc.invalidateQueries({ queryKey: ["crm-response"] });
      toast({ title: "Sales settings saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save settings", description: e.message, variant: "destructive" }),
  });
};

export interface StageSetting {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_open: boolean;
  is_won: boolean;
  is_lost: boolean;
  requires_next_action: boolean;
  counts_as_active: boolean;
  exempt_from_followup: boolean;
  stale_after_days: number | null;
  color: string;
  is_active: boolean;
}

export const useStageSettings = () =>
  useQuery({
    queryKey: ["crm-stage-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("crm_lead_stages").select("*").order("sort_order");
      if (error) throw error;
      return (data || []) as StageSetting[];
    },
    staleTime: 5 * 60_000,
  });

export const useUpdateStageSetting = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<StageSetting> & { id: string }) => {
      const { error } = await db.from("crm_lead_stages").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-stage-settings"] });
      qc.invalidateQueries({ queryKey: ["crm-config"] });
      qc.invalidateQueries({ queryKey: ["crm-action-board"] });
      toast({ title: "Stage settings saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save stage", description: e.message, variant: "destructive" }),
  });
};

/* -------------------------------- Automation ------------------------------- */

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  conditions: Record<string, any>;
  actions: Record<string, any>[];
  scope: Record<string, any>;
  cooldown_days: number;
  last_run_at: string | null;
  run_count: number;
  action_count: number;
  failure_count: number;
  last_error: string | null;
}

export const useAutomationRules = () =>
  useQuery({
    queryKey: ["crm-automation-rules"],
    queryFn: async () => {
      const { data, error } = await db
        .from("crm_automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AutomationRule[];
    },
  });

export const useAutomationRuns = (ruleId?: string | null) =>
  useQuery({
    queryKey: ["crm-automation-runs", ruleId],
    queryFn: async () => {
      let q = db
        .from("crm_automation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (ruleId) q = q.eq("rule_id", ruleId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

const invalidateAutomation = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["crm-automation-rules"] });
  qc.invalidateQueries({ queryKey: ["crm-automation-runs"] });
};

export const useSaveAutomationRule = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (rule: Partial<AutomationRule>) => {
      const { data: auth } = await supabase.auth.getUser();
      if (rule.id) {
        const { error } = await db.from("crm_automation_rules").update(rule).eq("id", rule.id);
        if (error) throw error;
        return rule.id;
      }
      const { data, error } = await db
        .from("crm_automation_rules")
        .insert({ ...rule, created_by: auth.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidateAutomation(qc);
      toast({ title: "Automation saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save automation", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteAutomationRule = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crm_automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAutomation(qc);
      toast({ title: "Automation removed" });
    },
  });
};

export const useRunAutomation = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (opts: { ruleId?: string; preview?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("crm-automation-run", {
        body: { rule_id: opts.ruleId ?? null, preview: !!opts.preview },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data, vars) => {
      invalidateAutomation(qc);
      qc.invalidateQueries({ queryKey: ["crm-action-board"] });
      const rows = data?.rules || [];
      const applied = rows.reduce((n: number, r: any) => n + (r.applied || 0), 0);
      toast({
        title: vars.preview ? "Preview only — nothing changed" : "Automation run finished",
        description: vars.preview
          ? `${applied} enquiries would be actioned.`
          : `${applied} enquiries actioned.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Automation run failed", description: e.message, variant: "destructive" }),
  });
};

/* ------------------------- Outcomes: lost and nurture ---------------------- */

export const useCloseLead = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      outcome: "lost" | "nurture";
      lost_reason?: string | null;
      lost_notes?: string | null;
      nurture_review_date?: string | null;
      future_interest_year?: number | null;
    }) => {
      const { id, outcome, ...rest } = input;
      const { error } = await db
        .from("leads")
        .update({
          stage: outcome,
          ...rest,
          closed_at: outcome === "lost" ? new Date().toISOString() : null,
          next_action_date: null,
          next_action_note: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm-lead"] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-lead-fact"] });
      qc.invalidateQueries({ queryKey: ["crm-action-board"] });
      toast({
        title: vars.outcome === "lost" ? "Enquiry closed as lost" : "Moved to long-term nurture",
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not update the enquiry", description: e.message, variant: "destructive" }),
  });
};