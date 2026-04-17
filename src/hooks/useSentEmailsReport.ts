import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export type SentEmailsRange = "7d" | "30d" | "90d" | "all";

export interface RawEmailLog {
  id: string;
  message_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  template_name: string | null;
  template_id: string | null;
  batch_id: string | null;
  tour_id: string | null;
  booking_id: string | null;
  sent_at: string;
  sent_by: string | null;
  error_message: string | null;
  tour?: { id: string; name: string } | null;
  email_events?: { event_type: string; created_at: string }[];
}

export interface EmailRowStatus {
  delivered: boolean;
  opened: boolean;
  bounced: boolean;
  complained: boolean;
  hasIssue: boolean;
  label: "Sent" | "Delivered" | "Opened" | "Bounced" | "Complained" | "Failed";
}

export interface IndividualEmailRow {
  kind: "individual";
  key: string; // log id
  sentAt: string;
  tourId: string | null;
  tourName: string | null;
  templateId: string | null;
  templateName: string | null;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  status: EmailRowStatus;
  errorMessage: string | null;
  raw: RawEmailLog;
}

export interface BulkEmailRow {
  kind: "bulk";
  key: string; // batch id
  sentAt: string;
  tourId: string | null;
  tourName: string | null;
  templateId: string | null;
  templateName: string | null;
  subject: string;
  recipientCount: number;
  delivered: number;
  opened: number;
  bounced: number;
  complained: number;
  failed: number;
  openRate: number; // percent
  hasIssue: boolean;
  logs: RawEmailLog[];
}

export type SentEmailRow = IndividualEmailRow | BulkEmailRow;

const computeStatus = (log: RawEmailLog): EmailRowStatus => {
  const events = log.email_events || [];
  const types = new Set(events.map((e) => e.event_type));
  const bounced = types.has("bounced");
  const complained = types.has("complained");
  const opened = types.has("opened");
  const delivered = types.has("delivered");
  const failed = !!log.error_message;

  let label: EmailRowStatus["label"] = "Sent";
  if (failed) label = "Failed";
  else if (bounced) label = "Bounced";
  else if (complained) label = "Complained";
  else if (opened) label = "Opened";
  else if (delivered) label = "Delivered";

  return {
    delivered,
    opened,
    bounced,
    complained,
    hasIssue: bounced || complained || failed,
    label,
  };
};

const rangeToFromDate = (range: SentEmailsRange): string | null => {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return subDays(new Date(), days).toISOString();
};

interface Options {
  range?: SentEmailsRange;
  tourId?: string | null;
  templateId?: string | null;
}

export const useSentEmailsReport = (options: Options = {}) => {
  const { range = "7d", tourId = null, templateId = null } = options;

  return useQuery({
    queryKey: ["sent-emails-report", range, tourId, templateId],
    staleTime: 30000,
    queryFn: async () => {
      let q = supabase
        .from("email_logs")
        .select(
          `
          id,
          message_id,
          recipient_email,
          recipient_name,
          subject,
          template_name,
          template_id,
          batch_id,
          tour_id,
          booking_id,
          sent_at,
          sent_by,
          error_message,
          tour:tours(id, name),
          email_events(event_type, created_at)
        `
        )
        .order("sent_at", { ascending: false })
        .limit(1000);

      const fromDate = rangeToFromDate(range);
      if (fromDate) q = q.gte("sent_at", fromDate);
      if (tourId) q = q.eq("tour_id", tourId);
      if (templateId) q = q.eq("template_id", templateId);

      const { data, error } = await q;
      if (error) throw error;

      const logs = (data || []) as unknown as RawEmailLog[];

      // Group by batch_id; logs without a batch_id are individual rows.
      const batches = new Map<string, RawEmailLog[]>();
      const individuals: RawEmailLog[] = [];
      logs.forEach((l) => {
        if (l.batch_id) {
          const arr = batches.get(l.batch_id) || [];
          arr.push(l);
          batches.set(l.batch_id, arr);
        } else {
          individuals.push(l);
        }
      });

      const rows: SentEmailRow[] = [];

      // Build bulk rows (only when batch has 2+ recipients; otherwise treat as individual)
      batches.forEach((batchLogs, batchId) => {
        if (batchLogs.length < 2) {
          individuals.push(...batchLogs);
          return;
        }
        const first = batchLogs[0];
        let delivered = 0,
          opened = 0,
          bounced = 0,
          complained = 0,
          failed = 0;
        batchLogs.forEach((l) => {
          const s = computeStatus(l);
          if (s.delivered) delivered++;
          if (s.opened) opened++;
          if (s.bounced) bounced++;
          if (s.complained) complained++;
          if (s.label === "Failed") failed++;
        });
        const openRate =
          delivered > 0 ? Math.round((opened / delivered) * 100) : 0;

        // Use earliest sent_at within batch as the bulk send time.
        const sortedAsc = [...batchLogs].sort(
          (a, b) =>
            new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        rows.push({
          kind: "bulk",
          key: batchId,
          sentAt: sortedAsc[0].sent_at,
          tourId: first.tour_id,
          tourName: first.tour?.name || null,
          templateId: first.template_id,
          templateName: first.template_name,
          subject: first.subject,
          recipientCount: batchLogs.length,
          delivered,
          opened,
          bounced,
          complained,
          failed,
          openRate,
          hasIssue: bounced + complained + failed > 0,
          logs: batchLogs,
        });
      });

      individuals.forEach((l) => {
        rows.push({
          kind: "individual",
          key: l.id,
          sentAt: l.sent_at,
          tourId: l.tour_id,
          tourName: l.tour?.name || null,
          templateId: l.template_id,
          templateName: l.template_name,
          subject: l.subject,
          recipientEmail: l.recipient_email,
          recipientName: l.recipient_name,
          status: computeStatus(l),
          errorMessage: l.error_message,
          raw: l,
        });
      });

      // Newest first
      rows.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );

      // Summary metrics across the whole filtered set
      const totalEmails = logs.length;
      const totalBulk = rows.filter((r) => r.kind === "bulk").length;
      const totalIndividual = rows.filter((r) => r.kind === "individual").length;
      let totalIssues = 0;
      logs.forEach((l) => {
        const s = computeStatus(l);
        if (s.hasIssue) totalIssues++;
      });

      return {
        rows,
        summary: {
          totalEmails,
          totalBulkSends: totalBulk,
          totalIndividualSends: totalIndividual,
          totalIssues,
        },
      };
    },
  });
};

/**
 * Lightweight per-template summary used inline in Tour Comms Settings.
 * Returns the most recent send (within range) for each template_id, scoped to a tour.
 */
export const useTourTemplateSendSummaries = (tourId: string) => {
  return useQuery({
    queryKey: ["tour-template-send-summaries", tourId],
    staleTime: 60000,
    enabled: !!tourId,
    queryFn: async () => {
      const fromDate = subDays(new Date(), 90).toISOString();
      const { data, error } = await supabase
        .from("email_logs")
        .select(
          `
          id,
          template_id,
          template_name,
          batch_id,
          sent_at,
          error_message,
          email_events(event_type)
        `
        )
        .eq("tour_id", tourId)
        .gte("sent_at", fromDate)
        .order("sent_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      type Row = {
        template_id: string | null;
        template_name: string | null;
        batch_id: string | null;
        sent_at: string;
        error_message: string | null;
        email_events: { event_type: string }[] | null;
      };

      const byTemplate = new Map<
        string,
        {
          templateId: string;
          lastSentAt: string;
          recipientCount: number;
          opened: number;
          delivered: number;
          issues: number;
        }
      >();

      (data as unknown as Row[] | null)?.forEach((r) => {
        if (!r.template_id) return;
        const events = r.email_events || [];
        const types = new Set(events.map((e) => e.event_type));
        const bounced = types.has("bounced");
        const complained = types.has("complained");
        const opened = types.has("opened");
        const delivered = types.has("delivered");
        const isIssue = bounced || complained || !!r.error_message;

        const existing = byTemplate.get(r.template_id);
        if (!existing) {
          byTemplate.set(r.template_id, {
            templateId: r.template_id,
            lastSentAt: r.sent_at,
            recipientCount: 1,
            opened: opened ? 1 : 0,
            delivered: delivered ? 1 : 0,
            issues: isIssue ? 1 : 0,
          });
        } else {
          // Newer sends sort first because we ordered desc
          existing.recipientCount += 1;
          if (opened) existing.opened += 1;
          if (delivered) existing.delivered += 1;
          if (isIssue) existing.issues += 1;
        }
      });

      return byTemplate;
    },
  });
};
