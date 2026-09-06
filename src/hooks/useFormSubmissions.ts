import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Website form submissions. Each row is the historical record of exactly what a
 * client submitted; editing the contact later never changes it.
 */

const db = supabase as any;

export interface FormSubmission {
  id: string;
  landing_page_id: string;
  submission_uid: string | null;
  customer_id: string | null;
  lead_id: string | null;
  task_id: string | null;
  payload: any;
  form_type: string | null;
  tour_ids: string[] | null;
  tour_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  country: string | null;
  travellers: number | null;
  previous_traveller: boolean | null;
  preferred_contact: string | null;
  message: string | null;
  consent_given: boolean | null;
  consent_text: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page_url: string | null;
  processing_status: string;
  processing_step: string | null;
  processing_error: string | null;
  needs_review: boolean;
  review_note: string | null;
  match_method: string | null;
  retry_count: number;
  processed_at: string | null;
  ack_email_status: string | null;
  created_at: string;
  landing_page?: { title: string; slug: string } | null;
  customer?: { id: string; first_name: string | null; last_name: string | null } | null;
  tour?: { id: string; name: string } | null;
}

const SELECT =
  "*, landing_page:landing_pages(title, slug), customer:customers(id, first_name, last_name), tour:tours(id, name)";

export interface SubmissionFilters {
  status?: string;
  needsReview?: boolean;
  formType?: string;
  search?: string;
}

export const useFormSubmissions = (filters: SubmissionFilters = {}) =>
  useQuery({
    queryKey: ["form-submissions", filters],
    queryFn: async () => {
      let q = db
        .from("landing_page_submissions")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters.status) q = q.eq("processing_status", filters.status);
      if (filters.needsReview) q = q.eq("needs_review", true);
      if (filters.formType) q = q.eq("form_type", filters.formType);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as FormSubmission[];
      const s = (filters.search || "").trim().toLowerCase();
      if (!s) return rows;
      return rows.filter((r) =>
        `${r.first_name || ""} ${r.last_name || ""} ${r.email || ""} ${r.phone || ""}`
          .toLowerCase()
          .includes(s)
      );
    },
    staleTime: 30_000,
  });

export const useCustomerSubmissions = (customerId?: string | null) =>
  useQuery({
    queryKey: ["form-submissions-customer", customerId],
    queryFn: async () => {
      const { data, error } = await db
        .from("landing_page_submissions")
        .select(SELECT)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FormSubmission[];
    },
    enabled: !!customerId,
  });

export const useLeadSubmissions = (leadId?: string | null) =>
  useQuery({
    queryKey: ["form-submissions-lead", leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from("landing_page_submissions")
        .select(SELECT)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FormSubmission[];
    },
    enabled: !!leadId,
  });

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["form-submissions"] });
  qc.invalidateQueries({ queryKey: ["form-submissions-customer"] });
  qc.invalidateQueries({ queryKey: ["form-submissions-lead"] });
  qc.invalidateQueries({ queryKey: ["crm-leads"] });
  qc.invalidateQueries({ queryKey: ["crm-timeline"] });
};

/** Re-run the CRM intake for a stored submission (used after a failure). */
export const useReprocessSubmission = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await supabase.functions.invoke("crm-reprocess-submission", {
        body: { submission_id: submissionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => {
      invalidate(qc);
      toast({
        title: data?.ok ? "Submission processed" : "Still needs attention",
        description: data?.ok
          ? "The enquiry is now in the CRM."
          : data?.result?.error || "Check the error shown on the submission.",
        variant: data?.ok ? undefined : "destructive",
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not process", description: e.message, variant: "destructive" }),
  });
};

/** Clear the needs-review flag once a person has checked the submission. */
export const useMarkSubmissionReviewed = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await db
        .from("landing_page_submissions")
        .update({ needs_review: false })
        .eq("id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: "Marked as reviewed" });
    },
    onError: (e: any) =>
      toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });
};
