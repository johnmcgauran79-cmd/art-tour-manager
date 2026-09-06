import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * CRM data layer: leads, tour interests, activities, relationships and
 * configurable stage/type/source lists. Every lead lives in `leads`; the legacy
 * `customers.lead_*` fields are kept in step by a database trigger so existing
 * marketing audiences and MCP tools keep working.
 */

const db = supabase as any;

export interface CrmStage {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_open: boolean;
  is_won: boolean;
  is_lost: boolean;
  requires_next_action: boolean;
  color: string;
  is_active: boolean;
}

export interface CrmOption {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  category?: string | null;
}

export interface Lead {
  id: string;
  customer_id: string;
  lead_type: string;
  tour_id: string | null;
  stage: string;
  priority: string;
  owner_id: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  partner: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page_url: string | null;
  form_slug: string | null;
  external_submission_id: string | null;
  submission_id: string | null;
  passengers: number | null;
  estimated_value: number | null;
  companions: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  notes: string | null;
  lost_reason: string | null;
  lost_notes: string | null;
  booking_id: string | null;
  converted_at: string | null;
  first_response_at: string | null;
  last_activity_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    state: string | null;
  } | null;
  tour?: { id: string; name: string; start_date: string | null } | null;
}

export interface CrmActivity {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  activity_type: string;
  direction: string | null;
  outcome: string | null;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  staff_id: string | null;
  task_id: string | null;
  created_at: string;
}

export interface TourInterest {
  id: string;
  customer_id: string;
  tour_id: string;
  lead_id: string | null;
  interest_level: string;
  status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  tour?: { id: string; name: string; start_date: string | null } | null;
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export interface ContactRelationship {
  id: string;
  customer_id: string;
  related_customer_id: string;
  relationship_type: string;
  notes: string | null;
  related?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const LEAD_SELECT =
  "*, customer:customers!leads_customer_id_fkey(id, first_name, last_name, email, phone, state), tour:tours!leads_tour_id_fkey(id, name, start_date)";

/* ------------------------------- Configuration ------------------------------ */

export const useCrmConfig = () =>
  useQuery({
    queryKey: ["crm-config"],
    queryFn: async () => {
      const [stages, types, sources, lostReasons] = await Promise.all([
        db.from("crm_lead_stages").select("*").order("sort_order"),
        db.from("crm_lead_types").select("*").order("sort_order"),
        db.from("crm_lead_sources").select("*").order("sort_order"),
        db.from("crm_lost_reasons").select("*").order("sort_order"),
      ]);
      const err =
        stages.error || types.error || sources.error || lostReasons.error;
      if (err) throw err;
      return {
        stages: (stages.data || []) as CrmStage[],
        types: (types.data || []) as CrmOption[],
        sources: (sources.data || []) as CrmOption[],
        lostReasons: (lostReasons.data || []) as CrmOption[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

/* ----------------------------------- Leads ---------------------------------- */

export interface LeadFilters {
  stage?: string;
  ownerId?: string;
  tourId?: string;
  source?: string;
  type?: string;
  priority?: string;
  openOnly?: boolean;
  search?: string;
}

export const useCrmLeads = (filters: LeadFilters = {}) =>
  useQuery({
    queryKey: ["crm-leads", filters],
    queryFn: async () => {
      let q = db.from("leads").select(LEAD_SELECT).order("created_at", { ascending: false }).limit(1000);
      if (filters.stage) q = q.eq("stage", filters.stage);
      if (filters.ownerId) q = q.eq("owner_id", filters.ownerId);
      if (filters.tourId) q = q.eq("tour_id", filters.tourId);
      if (filters.source) q = q.eq("source", filters.source);
      if (filters.type) q = q.eq("lead_type", filters.type);
      if (filters.priority) q = q.eq("priority", filters.priority);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Lead[];
    },
    staleTime: 30_000,
  });

export const useLead = (id?: string | null) =>
  useQuery({
    queryKey: ["crm-lead", id],
    queryFn: async () => {
      const { data, error } = await db.from("leads").select(LEAD_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
    enabled: !!id,
  });

export const useCustomerLeads = (customerId?: string | null) =>
  useQuery({
    queryKey: ["crm-leads-customer", customerId],
    queryFn: async () => {
      const { data, error } = await db
        .from("leads")
        .select(LEAD_SELECT)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!customerId,
  });

export const useLeadStageHistory = (leadId?: string | null) =>
  useQuery({
    queryKey: ["crm-lead-history", leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from("lead_stage_history")
        .select("*")
        .eq("lead_id", leadId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as {
        id: string;
        from_stage: string | null;
        to_stage: string;
        changed_at: string;
        changed_by: string | null;
        note: string | null;
      }[];
    },
    enabled: !!leadId,
  });

const invalidateLeads = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["crm-leads"] });
  qc.invalidateQueries({ queryKey: ["crm-leads-customer"] });
  qc.invalidateQueries({ queryKey: ["crm-lead"] });
  qc.invalidateQueries({ queryKey: ["crm-dashboard"] });
  qc.invalidateQueries({ queryKey: ["marketing-leads"] });
};

export const useCreateLead = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: Partial<Lead> & { customer_id: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("leads")
        .insert({ ...values, created_by: auth.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidateLeads(qc);
      toast({ title: "Lead created" });
    },
    onError: (e: any) =>
      toast({ title: "Could not create lead", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateLead = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { error } = await db.from("leads").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateLeads(qc),
    onError: (e: any) =>
      toast({ title: "Could not save lead", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteLead = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateLeads(qc);
      toast({ title: "Lead deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Could not delete lead", description: e.message, variant: "destructive" }),
  });
};

/* ------------------------------ Tour interests ------------------------------ */

export const useTourInterests = (params: { customerId?: string | null; tourId?: string | null }) =>
  useQuery({
    queryKey: ["crm-tour-interests", params],
    queryFn: async () => {
      let q = db
        .from("tour_interests")
        .select(
          "*, tour:tours!tour_interests_tour_id_fkey(id, name, start_date), customer:customers!tour_interests_customer_id_fkey(id, first_name, last_name, email)"
        )
        .order("created_at", { ascending: false });
      if (params.customerId) q = q.eq("customer_id", params.customerId);
      if (params.tourId) q = q.eq("tour_id", params.tourId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TourInterest[];
    },
    enabled: !!(params.customerId || params.tourId),
  });

export const useAddTourInterest = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: {
      customer_id: string;
      tour_id: string;
      lead_id?: string | null;
      interest_level?: string;
      source?: string | null;
      notes?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db
        .from("tour_interests")
        .upsert(
          { ...values, created_by: auth.user?.id ?? null },
          { onConflict: "customer_id,tour_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-tour-interests"] });
      toast({ title: "Tour interest saved" });
    },
    onError: (e: any) =>
      toast({ title: "Could not save interest", description: e.message, variant: "destructive" }),
  });
};

export const useRemoveTourInterest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("tour_interests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tour-interests"] }),
  });
};

/* -------------------------------- Activities -------------------------------- */

export const useCrmActivities = (params: { customerId?: string | null; leadId?: string | null }) =>
  useQuery({
    queryKey: ["crm-activities", params],
    queryFn: async () => {
      let q = db.from("crm_activities").select("*").order("occurred_at", { ascending: false }).limit(300);
      if (params.leadId) q = q.eq("lead_id", params.leadId);
      else if (params.customerId) q = q.eq("customer_id", params.customerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CrmActivity[];
    },
    enabled: !!(params.customerId || params.leadId),
  });

export interface LogActivityInput {
  customer_id?: string | null;
  lead_id?: string | null;
  activity_type: string;
  direction?: string | null;
  outcome?: string | null;
  subject?: string | null;
  body?: string | null;
  occurred_at?: string;
  /** Optional follow-up task created in the existing ART task manager. */
  followUp?: {
    title: string;
    due_date?: string | null;
    assignee_ids?: string[];
    crm_type?: string;
  } | null;
  /** Optional next action written back onto the lead. */
  next_action_date?: string | null;
  next_action_note?: string | null;
}

export const useLogActivity = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: LogActivityInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const { followUp, next_action_date, next_action_note, ...activity } = input;

      let taskId: string | null = null;
      if (followUp?.title) {
        const { data: task, error: taskError } = await db
          .from("tasks")
          .insert({
            title: followUp.title,
            description: activity.body || null,
            priority: "medium",
            category: "booking",
            status: "not_started",
            due_date: followUp.due_date || null,
            created_by: userId,
            customer_id: activity.customer_id || null,
            lead_id: activity.lead_id || null,
            crm_type: followUp.crm_type || "sales_follow_up",
            is_automated: false,
          })
          .select("id")
          .single();
        if (taskError) throw taskError;
        taskId = task.id as string;

        if (followUp.assignee_ids?.length) {
          await db.from("task_assignments").insert(
            followUp.assignee_ids.map((user_id) => ({ task_id: taskId, user_id, assigned_by: userId }))
          );
        }
        if (activity.customer_id) {
          await db
            .from("task_entity_links")
            .insert({ task_id: taskId, entity_type: "contact", entity_id: activity.customer_id, source: "crm" });
        }
      }

      const { error } = await db.from("crm_activities").insert({
        ...activity,
        occurred_at: activity.occurred_at || new Date().toISOString(),
        staff_id: userId,
        created_by: userId,
        task_id: taskId,
      });
      if (error) throw error;

      if (activity.lead_id && (next_action_date !== undefined || next_action_note !== undefined)) {
        await db
          .from("leads")
          .update({
            next_action_date: next_action_date || null,
            next_action_note: next_action_note || null,
          })
          .eq("id", activity.lead_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-activities"] });
      qc.invalidateQueries({ queryKey: ["crm-timeline"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      invalidateLeads(qc);
      toast({ title: "Activity logged" });
    },
    onError: (e: any) =>
      toast({ title: "Could not log activity", description: e.message, variant: "destructive" }),
  });
};

/* ------------------------------ Relationships ------------------------------- */

export const useContactRelationships = (customerId?: string | null) =>
  useQuery({
    queryKey: ["crm-relationships", customerId],
    queryFn: async () => {
      const { data, error } = await db
        .from("contact_relationships")
        .select(
          "*, related:customers!contact_relationships_related_customer_id_fkey(id, first_name, last_name, email)"
        )
        .eq("customer_id", customerId);
      if (error) throw error;
      return (data || []) as ContactRelationship[];
    },
    enabled: !!customerId,
  });

export const useAddRelationship = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: {
      customer_id: string;
      related_customer_id: string;
      relationship_type: string;
      notes?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db
        .from("contact_relationships")
        .insert({ ...values, created_by: auth.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-relationships"] });
      toast({ title: "Relationship added" });
    },
    onError: (e: any) =>
      toast({ title: "Could not add relationship", description: e.message, variant: "destructive" }),
  });
};

export const useRemoveRelationship = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("contact_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-relationships"] }),
  });
};

/* --------------------------------- Timeline -------------------------------- */

export interface TimelineEntry {
  id: string;
  kind: "activity" | "form" | "lead" | "task" | "booking" | "email";
  at: string;
  title: string;
  detail?: string | null;
  link?: string | null;
}

export const useContactTimeline = (customerId?: string | null, email?: string | null) =>
  useQuery({
    queryKey: ["crm-timeline", customerId, email],
    queryFn: async () => {
      const [activities, submissions, leads, tasks, bookings, emails] = await Promise.all([
        db.from("crm_activities").select("*").eq("customer_id", customerId).order("occurred_at", { ascending: false }).limit(200),
        db.from("landing_page_submissions").select("id, created_at, form_type, message, tour_id, landing_page_id").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100),
        db.from("lead_stage_history").select("id, changed_at, from_stage, to_stage, lead_id, leads!inner(customer_id)").eq("leads.customer_id", customerId).order("changed_at", { ascending: false }).limit(200),
        db.from("tasks").select("id, title, status, created_at, completed_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100),
        db.from("bookings").select("id, created_at, status, tours(name)").eq("lead_passenger_id", customerId).order("created_at", { ascending: false }).limit(100),
        email
          ? db.from("campaign_recipients").select("id, sent_at, opened_at, clicked_at, email, marketing_campaigns(name)").eq("email", email).order("sent_at", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const entries: TimelineEntry[] = [];

      for (const a of activities.data || []) {
        entries.push({
          id: `activity-${a.id}`,
          kind: "activity",
          at: a.occurred_at,
          title: `${a.activity_type.replace(/_/g, " ")}${a.subject ? ` — ${a.subject}` : ""}`,
          detail: a.body,
        });
      }
      for (const s of submissions.data || []) {
        entries.push({
          id: `form-${s.id}`,
          kind: "form",
          at: s.created_at,
          title: s.form_type === "booking" ? "Booking form submitted" : "Register interest submitted",
          detail: s.message,
        });
      }
      for (const h of leads.data || []) {
        entries.push({
          id: `lead-${h.id}`,
          kind: "lead",
          at: h.changed_at,
          title: h.from_stage
            ? `Lead moved ${h.from_stage.replace(/_/g, " ")} → ${h.to_stage.replace(/_/g, " ")}`
            : `Lead created (${h.to_stage.replace(/_/g, " ")})`,
          link: `/leads/${h.lead_id}`,
        });
      }
      for (const t of tasks.data || []) {
        entries.push({
          id: `task-${t.id}`,
          kind: "task",
          at: t.completed_at || t.created_at,
          title: `${t.completed_at ? "Task completed" : "Task created"} — ${t.title}`,
          link: `/tasks/${t.id}`,
        });
      }
      for (const b of bookings.data || []) {
        entries.push({
          id: `booking-${b.id}`,
          kind: "booking",
          at: b.created_at,
          title: `Booking — ${b.tours?.name || "tour"} (${b.status})`,
          link: `/bookings/${b.id}`,
        });
      }
      for (const r of emails.data || []) {
        if (!r.sent_at) continue;
        entries.push({
          id: `email-${r.id}`,
          kind: "email",
          at: r.sent_at,
          title: `Campaign sent — ${r.marketing_campaigns?.name || "EDM"}`,
          detail: [r.opened_at ? "opened" : null, r.clicked_at ? "clicked" : null]
            .filter(Boolean)
            .join(", ") || null,
        });
      }

      return entries
        .filter((e) => !!e.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
    enabled: !!customerId,
  });

/* -------------------------------- Dashboard -------------------------------- */

export const useCrmDashboard = (days = 30) =>
  useQuery({
    queryKey: ["crm-dashboard", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [leadsRes, stagesRes] = await Promise.all([
        db.from("leads").select(LEAD_SELECT).order("created_at", { ascending: false }).limit(2000),
        db.from("crm_lead_stages").select("*").order("sort_order"),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const leads = (leadsRes.data || []) as Lead[];
      const stages = (stagesRes.data || []) as CrmStage[];
      const stageMap = new Map(stages.map((s) => [s.key, s]));
      const isOpen = (l: Lead) => stageMap.get(l.stage)?.is_open ?? true;
      const isWon = (l: Lead) => stageMap.get(l.stage)?.is_won ?? false;
      const isLost = (l: Lead) => stageMap.get(l.stage)?.is_lost ?? false;
      const needsNextAction = (l: Lead) =>
        isOpen(l) && (stageMap.get(l.stage)?.requires_next_action ?? true) && !l.next_action_date;

      const today = new Date().toISOString().slice(0, 10);
      const recent = leads.filter((l) => l.created_at >= since);
      const won = leads.filter(isWon);
      const responded = recent.filter((l) => l.first_response_at);
      const avgResponseHours = responded.length
        ? responded.reduce(
            (sum, l) =>
              sum +
              (new Date(l.first_response_at as string).getTime() - new Date(l.created_at).getTime()) /
                3_600_000,
            0
          ) / responded.length
        : null;
      const convertedInWindow = won.filter((l) => (l.converted_at || "") >= since);
      const avgDaysToBooking = convertedInWindow.length
        ? convertedInWindow.reduce(
            (sum, l) =>
              sum +
              (new Date(l.converted_at as string).getTime() - new Date(l.created_at).getTime()) /
                86_400_000,
            0
          ) / convertedInWindow.length
        : null;

      return {
        stages,
        leads,
        newLeads: leads.filter((l) => l.stage === "new"),
        uncontacted: leads.filter((l) => isOpen(l) && ["new", "attempting_contact"].includes(l.stage)),
        dueToday: leads.filter((l) => isOpen(l) && l.next_action_date === today),
        overdue: leads.filter((l) => isOpen(l) && !!l.next_action_date && l.next_action_date < today),
        bookingEnquiries: leads.filter(
          (l) => isOpen(l) && ["booking_form", "booking_enquiry"].includes(l.lead_type)
        ),
        noNextAction: leads.filter(needsNextAction),
        recentlyActive: [...leads]
          .filter(isOpen)
          .sort((a, b) => (b.last_activity_at || "").localeCompare(a.last_activity_at || ""))
          .slice(0, 20),
        metrics: {
          received: recent.length,
          openTotal: leads.filter(isOpen).length,
          won: convertedInWindow.length,
          lost: leads.filter((l) => isLost(l) && (l.closed_at || "") >= since).length,
          conversionRate: recent.length
            ? Math.round((convertedInWindow.length / recent.length) * 100)
            : 0,
          pipelineValue: leads
            .filter(isOpen)
            .reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
          wonValue: convertedInWindow.reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
          avgResponseHours,
          avgDaysToBooking,
        },
      };
    },
    staleTime: 60_000,
  });
