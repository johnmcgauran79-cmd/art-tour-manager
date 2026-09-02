import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EdmBlock } from "@/lib/edm/blocks";
import type { AudienceFilters } from "@/lib/edm/audience";
import type { FormFieldDef } from "@/lib/marketing/formFields";


export interface MarketingCampaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  brand_id: string | null;
  audience_id: string | null;
  audience_filters: AudienceFilters | null;
  editor_mode: "blocks" | "html";
  blocks: EdmBlock[];
  html_body: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_send_at: string | null;
  send_started_at: string | null;
  send_completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingAudience {
  id: string;
  name: string;
  description: string | null;
  filters: AudienceFilters;
  last_count: number | null;
  last_counted_at: string | null;
  created_at: string;
}

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  subheadline: string | null;
  body_html: string | null;
  hero_image_url: string | null;
  brand_id: string | null;
  tour_id: string | null;
  form_type: "interest" | "booking";
  tour_ids: string[];
  success_redirect_url: string | null;
  notify_teams: boolean;
  fields: FormFieldDef[];
  consent_text: string | null;
  thank_you_message: string | null;
  thank_you_heading: string | null;
  submit_button_text: string | null;

  lead_source: string | null;
  lead_owner_id: string | null;
  /** Staff assigned to the task created by each submission. */
  task_assignee_ids: string[];
  /** Staff added as followers (watchers) on the task. */
  task_watcher_ids: string[];
  /** Tags automatically applied to every contact who submits this form. */
  auto_tag_ids: string[];
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_type: "form_submitted" | "lead_stage_changed";
  trigger_config: { landing_page_id?: string; lead_stage?: string };
  actions: AutomationAction[];
  is_active: boolean;
  created_at: string;
}

export type AutomationAction =
  | { type: "send_template"; template_id: string }
  | { type: "create_task"; title: string; assignee_id?: string; due_in_days?: number }
  | { type: "notify_teams"; message?: string }
  | { type: "set_stage"; lead_stage: string };

/* ---------------------------------- Campaigns --------------------------------- */

export const useCampaigns = () =>
  useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MarketingCampaign[];
    },
    staleTime: 30000,
  });

export const useCampaign = (id: string | undefined) =>
  useQuery({
    queryKey: ["marketing-campaign", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MarketingCampaign | null;
    },
  });

export const useSaveCampaign = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MarketingCampaign> & { id?: string }) => {
      const { id, ...rest } = input;
      const payload: any = { ...rest };
      if (id) {
        const { data, error } = await supabase
          .from("marketing_campaigns")
          .update(payload)
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as MarketingCampaign;
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .insert({ ...payload, created_by: user?.id })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MarketingCampaign;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      if (c?.id) qc.invalidateQueries({ queryKey: ["marketing-campaign", c.id] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteCampaign = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast({ title: "Campaign deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useCampaignRecipients = (campaignId: string | undefined) =>
  useQuery({
    queryKey: ["campaign-recipients", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("id, email, first_name, last_name, status, error_message, sent_at, open_count, click_count")
        .eq("campaign_id", campaignId!)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

/* ---------------------------------- Audiences --------------------------------- */

export const useAudiences = () =>
  useQuery({
    queryKey: ["marketing-audiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_audiences")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as MarketingAudience[];
    },
  });

export const useSaveAudience = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MarketingAudience> & { id?: string }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("marketing_audiences")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("marketing_audiences")
        .insert({ ...(rest as any), created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-audiences"] });
      toast({ title: "Audience saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteAudience = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_audiences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-audiences"] });
      toast({ title: "Audience deleted" });
    },
  });
};

/* -------------------------------- Landing pages ------------------------------- */

export const useLandingPages = () =>
  useQuery({
    queryKey: ["landing-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LandingPage[];
    },
  });

export const useSaveLandingPage = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LandingPage> & { id?: string }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("landing_pages")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("landing_pages")
        .insert({ ...(rest as any), created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-pages"] });
      toast({ title: "Landing page saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteLandingPage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-pages"] });
      toast({ title: "Landing page deleted" });
    },
  });
};

export const useLandingSubmissions = () =>
  useQuery({
    queryKey: ["landing-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_submissions")
        .select("*, landing_page:landing_pages(title, slug), tour:tours(id, name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

/* ------------------------------------ Leads ----------------------------------- */

export interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null
  email: string | null;
  phone: string | null;
  state: string | null;
  lead_stage: string;
  lead_source: string | null;
  lead_owner_id: string | null;
  interested_tour_id: string | null;
  lead_next_action_date: string | null;
  lead_notes: string | null;
  created_at: string;
  interested_tour?: { id: string; name: string } | null;
}

export const useLeads = () =>
  useQuery({
    queryKey: ["marketing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, email, phone, state, lead_stage, lead_source, lead_owner_id, interested_tour_id, lead_next_action_date, lead_notes, created_at, interested_tour:tours!interested_tour_id(id, name)"
        )
        .neq("lead_stage", "none")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as LeadRow[];
    },
    staleTime: 30000,
  });

export const useUpdateLead = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadRow> & { id: string }) => {
      const { error } = await supabase
        .from("customers")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-leads"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

/* --------------------------------- Automation --------------------------------- */

export const useAutomationRules = () =>
  useQuery({
    queryKey: ["marketing-automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AutomationRule[];
    },
  });

export const useSaveAutomationRule = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AutomationRule> & { id?: string }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("marketing_automation_rules")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("marketing_automation_rules")
        .insert({ ...(rest as any), created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-automation-rules"] });
      toast({ title: "Automation rule saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteAutomationRule = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-automation-rules"] });
      toast({ title: "Rule deleted" });
    },
  });
};

/* ------------------------------- Campaign sending ----------------------------- */

interface SendRecipient {
  email: string;
  customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export const useSendCampaign = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      recipients,
      onProgress,
    }: {
      campaignId: string;
      recipients: SendRecipient[];
      onProgress?: (sent: number, total: number) => void;
    }) => {
      // 1. Queue every recipient server-side (chunked to keep payloads small).
      for (let i = 0; i < recipients.length; i += 500) {
        const { error } = await supabase.functions.invoke("marketing-send-campaign", {
          body: { action: "prepare", campaignId, recipients: recipients.slice(i, i + 500) },
        });
        if (error) throw error;
      }

      // 2. Drain the queue in batches until nothing is left.
      let guard = 0;
      for (;;) {
        const { data, error } = await supabase.functions.invoke("marketing-send-campaign", {
          body: { action: "process", campaignId, batchSize: 40 },
        });
        if (error) throw error;
        const res = data as {
          sent: number;
          failed: number;
          remaining: number;
          total: number;
          quotaExceeded?: boolean;
        };
        onProgress?.(res.total - res.remaining, res.total);
        if (res.quotaExceeded) return { quotaExceeded: true, remaining: res.remaining };
        if (res.remaining <= 0) break;
        if (++guard > 500) break;
      }
      return { quotaExceeded: false, remaining: 0 };
    },
    onSuccess: (result, v) => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-recipients", v.campaignId] });
      if (result?.quotaExceeded) {
        toast({
          title: "Daily sending quota reached",
          description: `${result.remaining} recipient(s) are still queued. Retry from Emails sent once the quota resets.`,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Campaign sent", description: "All queued emails have been processed." });
    },
    onError: (e: any) =>
      toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });
};

/**
 * Re-queue every failed recipient of a campaign and drain the queue again.
 * Recipients already marked sent are untouched, so nobody gets a duplicate.
 */
export const useRetryFailedRecipients = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string }) => {
      const { data: rq, error: rqErr } = await supabase.functions.invoke(
        "marketing-send-campaign",
        { body: { action: "requeue_failed", campaignId } }
      );
      if (rqErr) throw rqErr;
      const requeued = (rq as { requeued?: number })?.requeued || 0;
      if (!requeued) return { requeued: 0, quotaExceeded: false, remaining: 0 };

      let guard = 0;
      for (;;) {
        const { data, error } = await supabase.functions.invoke("marketing-send-campaign", {
          body: { action: "process", campaignId, batchSize: 40 },
        });
        if (error) throw error;
        const res = data as { remaining: number; quotaExceeded?: boolean };
        if (res.quotaExceeded) return { requeued, quotaExceeded: true, remaining: res.remaining };
        if (res.remaining <= 0) break;
        if (++guard > 500) break;
      }
      return { requeued, quotaExceeded: false, remaining: 0 };
    },
    onSuccess: (result, v) => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-recipients", v.campaignId] });
      if (!result.requeued) {
        toast({ title: "Nothing to retry", description: "No failed recipients on this campaign." });
        return;
      }
      if (result.quotaExceeded) {
        toast({
          title: "Daily sending quota reached again",
          description: `${result.remaining} recipient(s) remain queued — try again after the quota resets.`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Retry complete",
        description: `${result.requeued} recipient(s) re-processed.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Retry failed", description: e.message, variant: "destructive" }),
  });
};


/** Queue recipients without sending — used when scheduling a campaign. */
export const useQueueCampaignRecipients = () => {
  return useMutation({
    mutationFn: async ({
      campaignId,
      recipients,
    }: {
      campaignId: string;
      recipients: SendRecipient[];
    }) => {
      for (let i = 0; i < recipients.length; i += 500) {
        const { error } = await supabase.functions.invoke("marketing-send-campaign", {
          body: { action: "prepare", campaignId, recipients: recipients.slice(i, i + 500) },
        });
        if (error) throw error;
      }
    },
  });
};

export const useSendCampaignTest = () => {

  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ campaignId, email }: { campaignId: string; email: string }) => {
      const { error } = await supabase.functions.invoke("marketing-send-campaign", {
        body: { action: "test", campaignId, testEmail: email },
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Test email sent" }),
    onError: (e: any) =>
      toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });
};

/** Send a one-off test of arbitrary template HTML (no campaign required). */
export const useSendTemplateTest = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      email,
      html,
      subject,
      brandId,
    }: {
      email: string;
      html: string;
      subject?: string | null;
      brandId?: string | null;
    }) => {
      const { error } = await supabase.functions.invoke("marketing-send-campaign", {
        body: { action: "test", testEmail: email, html, subject, brandId },
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Test email sent" }),
    onError: (e: any) =>
      toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });
};

/* ------------------------------- EDM templates -------------------------------- */

export interface EdmTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subject: string | null;
  preheader: string | null;
  version: number;
  parent_template_id: string | null;
  is_archived: boolean;
  editor_mode: "blocks" | "html";
  blocks: EdmBlock[];
  html_body: string | null;
  brand_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useEdmTemplates = (opts: { includeArchived?: boolean } = {}) =>
  useQuery({
    queryKey: ["edm-templates", opts.includeArchived === true],
    queryFn: async () => {
      let query = supabase.from("edm_templates").select("*");
      if (!opts.includeArchived) query = query.eq("is_archived", false);
      const { data, error } = await query
        .order("category")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EdmTemplateRow[];
    },
  });

/**
 * Create or update a template. Pass an `id` to overwrite in place, or
 * `saveAsNewVersion: true` to keep the original and store an incremented
 * version copy (full template versioning for the marketing team).
 */
export const useSaveEdmTemplate = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<EdmTemplateRow> & {
        id?: string;
        saveAsNewVersion?: boolean;
        /** Autosave: persist without showing a toast. */
        silent?: boolean;
      }
    ) => {
      const { id, saveAsNewVersion, silent, created_at, updated_at, ...rest } = input as any;
      const user = (await supabase.auth.getUser()).data.user;

      if (id && !saveAsNewVersion) {
        const { data, error } = await supabase
          .from("edm_templates")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as EdmTemplateRow;
      }

      const payload: any = { ...rest, created_by: user?.id };
      if (id && saveAsNewVersion) {
        const { data: original } = await supabase
          .from("edm_templates")
          .select("version, parent_template_id")
          .eq("id", id)
          .maybeSingle();
        payload.parent_template_id = (original as any)?.parent_template_id || id;
        payload.version = ((original as any)?.version || 1) + 1;
      }

      const { data, error } = await supabase
        .from("edm_templates")
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EdmTemplateRow;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["edm-templates"] });
      if (v.silent) return;
      toast({
        title: v.id && !v.saveAsNewVersion ? "Template updated" : "Template saved",
      });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useArchiveEdmTemplate = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("edm_templates")
        .update({ is_archived: archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["edm-templates"] });
      toast({ title: v.archived ? "Template archived" : "Template restored" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteEdmTemplate = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("edm_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edm-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};


/* --------------------------- Contact lead / task history ---------------------- */

export interface ContactHistoryTask {
  id: string;
  title: string;
  status: string;
  category: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  completed_at?: string | null;
}

/**
 * Full lead/booking history for a contact: every form submission plus every
 * task linked to them (including completed and archived ones) so staff always
 * have the paper trail on the contact profile.
 */
export const useContactLeadHistory = (customerId: string | undefined) =>
  useQuery({
    queryKey: ["contact-lead-history", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const [subs, links] = await Promise.all([
        supabase
          .from("landing_page_submissions")
          .select(
            "id, form_type, created_at, message, payload, task_id, consent_given, tour_ids, landing_page:landing_pages(title, slug, form_type)"
          )
          .eq("customer_id", customerId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("task_entity_links")
          .select("task_id")
          .eq("entity_type", "contact")
          .eq("entity_id", customerId!),
      ]);
      if (subs.error) throw subs.error;
      if (links.error) throw links.error;

      const taskIds = Array.from(
        new Set([
          ...(links.data || []).map((l: any) => l.task_id),
          ...(subs.data || []).map((s: any) => s.task_id).filter(Boolean),
        ])
      );

      let tasks: ContactHistoryTask[] = [];
      if (taskIds.length) {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, status, category, priority, due_date, created_at")
          .in("id", taskIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        tasks = (data || []) as ContactHistoryTask[];
      }

      return { submissions: subs.data || [], tasks };
    },
  });

/* -------------------------------- Lead tasks -------------------------------- */

/**
 * Tasks generated by public interest/booking forms (landing page submissions),
 * so the Sales manager can work every lead task in one place.
 */
export const useLeadTasks = () =>
  useQuery({
    queryKey: ["lead-tasks"],
    queryFn: async () => {
      const { data: subs, error: subErr } = await supabase
        .from("landing_page_submissions")
        .select("task_id, form_type, created_at, landing_page:landing_pages(title, slug)")
        .not("task_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (subErr) throw subErr;

      const taskIds = Array.from(
        new Set((subs || []).map((s: any) => s.task_id).filter(Boolean) as string[])
      );
      if (taskIds.length === 0) return [] as any[];

      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*, tours (name), task_assignments (user_id)")
        .in("id", taskIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const assigneeIds = Array.from(
        new Set(
          (tasks || []).flatMap((t: any) => (t.task_assignments || []).map((a: any) => a.user_id))
        )
      );
      const profileMap: Record<string, any> = {};
      if (assigneeIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", assigneeIds);
        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      const subByTask: Record<string, any> = {};
      (subs || []).forEach((s: any) => {
        if (s.task_id && !subByTask[s.task_id]) subByTask[s.task_id] = s;
      });

      return (tasks || []).map((t: any) => ({
        ...t,
        task_assignments: (t.task_assignments || []).map((a: any) => ({
          user_id: a.user_id,
          profiles: profileMap[a.user_id] || null,
        })),
        lead_form_type: subByTask[t.id]?.form_type || null,
        lead_form_title: subByTask[t.id]?.landing_page?.title || null,
      }));
    },
    staleTime: 30000,
  });
