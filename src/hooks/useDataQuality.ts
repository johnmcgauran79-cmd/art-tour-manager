import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Data Quality engine.
 *
 * Answers "is our contact, enquiry and invoice data clean?" — the counterpart to
 * Tour Readiness (useDataHealth), which answers "can we run this tour?".
 *
 * All heavy lifting happens in three admin/manager-only database functions so the
 * browser only downloads the offending rows, never whole tables.
 */

export type DataQualityArea = "contacts" | "leads" | "finance";

export interface DataQualityIssue {
  issueKey: string;
  issueType: string;
  entityId: string | null;
  subject: string;
  detail: string;
  extra: Record<string, any>;
  area: DataQualityArea;
  dismissed: boolean;
}

export const ISSUE_LABELS: Record<string, string> = {
  duplicate_email: "Duplicate contacts (same email)",
  duplicate_name: "Duplicate contacts (same name)",
  missing_phone: "Missing phone number",
  invalid_email: "Missing or invalid email",
  missing_location: "Missing state / country",

  lead_no_owner: "Enquiry with no owner",
  lead_no_tour: "Enquiry with no tour",
  lead_no_pax: "Passenger numbers unknown",
  lead_no_lost_reason: "Lost with no reason",
  lead_won_no_booking: "Won with no booking",
  lead_no_source: "No lead source",
  xero_invoice_dead: "Xero invoice deleted or voided",
  xero_reference_mismatch: "Invoice reference mismatch",
  xero_not_linked: "Invoiced but not linked to Xero",
};

export const AREA_LABELS: Record<DataQualityArea, string> = {
  contacts: "Contacts",
  leads: "Enquiries",
  finance: "Finance",
};

const AREA_TYPES: Record<DataQualityArea, string[]> = {
  contacts: ["duplicate_email", "duplicate_name", "missing_phone", "invalid_email", "missing_location"],
  leads: [
    "lead_no_owner",
    "lead_no_tour",
    "lead_no_pax",
    "lead_no_lost_reason",
    "lead_won_no_booking",
    "lead_no_source",
  ],
  finance: ["xero_invoice_dead", "xero_reference_mismatch", "xero_not_linked"],
};

const areaOf = (issueType: string): DataQualityArea => {
  for (const area of Object.keys(AREA_TYPES) as DataQualityArea[]) {
    if (AREA_TYPES[area].includes(issueType)) return area;
  }
  return "contacts";
};

interface RawIssue {
  issue_key: string;
  issue_type: string;
  entity_id: string | null;
  subject: string | null;
  detail: string | null;
  extra: any;
}

const toIssue = (row: RawIssue, dismissedKeys: Set<string>): DataQualityIssue => ({
  issueKey: row.issue_key,
  issueType: row.issue_type,
  entityId: row.entity_id,
  subject: row.subject || "—",
  detail: row.detail || "",
  extra: (row.extra || {}) as Record<string, any>,
  area: areaOf(row.issue_type),
  dismissed: dismissedKeys.has(row.issue_key),
});

/** 100 = clean. Issues are weighed against how many records exist in that area. */
const scoreFor = (issues: number, population: number) => {
  if (population <= 0) return 100;
  const ratio = Math.min(1, issues / population);
  return Math.max(0, Math.round(100 - ratio * 100));
};

export interface DataQualityResult {
  issues: DataQualityIssue[];
  byArea: Record<DataQualityArea, DataQualityIssue[]>;
  counts: Record<DataQualityArea, number>;
  scores: Record<DataQualityArea, number>;
  overall: number;
  totals: { contacts: number; leads: number; bookings: number };
}

export const useDataQuality = () => {
  return useQuery({
    queryKey: ["data-quality"],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<DataQualityResult> => {
      const [contactRes, leadRes, financeRes, dismissRes, contactCount, leadCount, bookingCount] =
        await Promise.all([
          supabase.rpc("dq_contact_issues" as never),
          supabase.rpc("dq_lead_issues" as never),
          supabase.rpc("dq_finance_issues" as never),
          supabase.from("data_quality_dismissals").select("issue_key"),
          supabase.from("customers").select("*", { count: "exact", head: true }),
          supabase.from("leads").select("*", { count: "exact", head: true }),
          supabase.from("bookings").select("*", { count: "exact", head: true }).is("cancelled_at", null),
        ]);

      for (const r of [contactRes, leadRes, financeRes]) {
        if (r.error) throw r.error;
      }

      const dismissedKeys = new Set<string>(((dismissRes.data as any[]) || []).map((d) => d.issue_key));
      const rows: RawIssue[] = [
        ...((contactRes.data as any[]) || []),
        ...((leadRes.data as any[]) || []),
        ...((financeRes.data as any[]) || []),
      ];

      const issues = rows.map((r) => toIssue(r, dismissedKeys));
      const byArea: Record<DataQualityArea, DataQualityIssue[]> = { contacts: [], leads: [], finance: [] };
      for (const i of issues) byArea[i.area].push(i);

      const totals = {
        contacts: contactCount.count ?? 0,
        leads: leadCount.count ?? 0,
        bookings: bookingCount.count ?? 0,
      };

      const open = (area: DataQualityArea) => byArea[area].filter((i) => !i.dismissed).length;
      const counts = { contacts: open("contacts"), leads: open("leads"), finance: open("finance") };
      const scores = {
        contacts: scoreFor(counts.contacts, totals.contacts),
        leads: scoreFor(counts.leads, totals.leads),
        finance: scoreFor(counts.finance, totals.bookings),
      };
      const overall = Math.round((scores.contacts + scores.leads + scores.finance) / 3);

      return { issues, byArea, counts, scores, overall, totals };
    },
  });
};

/** Mark an item as "not a problem" (or undo that). */
export const useDismissDataQualityIssue = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      issue,
      dismiss,
      note,
    }: {
      issue: DataQualityIssue;
      dismiss: boolean;
      note?: string;
    }) => {
      if (!dismiss) {
        const { error } = await supabase
          .from("data_quality_dismissals")
          .delete()
          .eq("issue_key", issue.issueKey);
        if (error) throw error;
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("data_quality_dismissals").insert({
        issue_key: issue.issueKey,
        issue_type: issue.issueType,
        entity_id: issue.entityId,
        note: note || null,
        dismissed_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["data-quality"] });
      toast({
        title: vars.dismiss ? "Marked as not a problem" : "Restored",
        description: vars.dismiss
          ? "This item no longer counts towards your data quality score."
          : "This item counts again.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });
};

/** Lightweight summary for the dashboard card. */
export const useDataQualitySummary = () => {
  const { data, isLoading } = useDataQuality();
  return useMemo(
    () => ({
      isLoading,
      overall: data?.overall ?? 100,
      counts: data?.counts ?? { contacts: 0, leads: 0, finance: 0 },
      openIssues: data ? data.counts.contacts + data.counts.leads + data.counts.finance : 0,
    }),
    [data, isLoading]
  );
};
