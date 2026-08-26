import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO } from "date-fns";

export type UpcomingSource =
  | "scheduled_batch"
  | "status_change"
  | "one_off"
  | "forecast";

export type UpcomingStatus =
  | "Awaiting approval"
  | "Approved"
  | "Scheduled"
  | "Forecast";

export interface UpcomingEmailRow {
  key: string;
  source: UpcomingSource;
  /** yyyy-MM-dd or ISO datetime for one-off sends. */
  dueAt: string;
  hasTime: boolean;
  tourId: string | null;
  tourName: string | null;
  tourStartDate: string | null;
  ruleName: string | null;
  templateName: string | null;
  recipientCount: number;
  status: UpcomingStatus;
}

interface Options {
  tourId?: string | null;
  /** How many days ahead to include. Use null for no upper bound. */
  daysAhead?: number | null;
  /** Include projected sends from active automation rules. */
  includeForecast?: boolean;
}

const statusFor = (approval: string | null | undefined): UpcomingStatus => {
  if (approval === "approved") return "Approved";
  if (approval === "pending_approval" || approval === "pending") return "Awaiting approval";
  return "Scheduled";
};

export const useUpcomingEmails = (options: Options = {}) => {
  const { tourId = null, daysAhead = 14, includeForecast = true } = options;

  return useQuery({
    queryKey: ["upcoming-emails", tourId, daysAhead, includeForecast],
    staleTime: 60000,
    refetchInterval: 180000,
    queryFn: async () => {
      const today = new Date();
      const horizon = daysAhead == null ? null : addDays(today, daysAhead);
      const horizonDate = horizon ? format(horizon, "yyyy-MM-dd") : null;

      // --- 1. Automated batch records (pending approval / approved, not yet sent)
      let batchQ = supabase
        .from("automated_email_log")
        .select(
          `id, tour_id, tour_start_date, days_before_send, booking_count, approval_status, sent_at,
           tour:tours(id, name, start_date),
           rule:automated_email_rules(rule_name, days_before_tour, email_templates:email_templates(name)),
           override_template:email_templates(name)`
        )
        .in("approval_status", ["pending_approval", "approved"])
        .is("booking_id", null)
        .is("sent_at", null);
      if (tourId) batchQ = batchQ.eq("tour_id", tourId);

      // --- 2. Status-change queue items awaiting approval / approved
      let queueQ = supabase
        .from("status_change_email_queue")
        .select(
          `id, tour_id, batch_date, approval_status,
           tour:tours(id, name, start_date),
           rule:automated_email_rules(rule_name, email_templates:email_templates(name)),
           override_template:email_templates(name)`
        )
        .in("approval_status", ["pending_approval", "approved"])
        .is("processed_at", null);
      if (tourId) queueQ = queueQ.eq("tour_id", tourId);

      // --- 3. One-off scheduled sends
      let schedQ = supabase
        .from("scheduled_emails")
        .select(`id, tour_id, scheduled_send_at, status, email_payload, tour:tours(id, name, start_date)`)
        .in("status", ["scheduled", "approved"]);
      if (tourId) schedQ = schedQ.eq("tour_id", tourId);

      const [batches, queue, scheduled] = await Promise.all([batchQ, queueQ, schedQ]);
      if (batches.error) throw batches.error;
      if (queue.error) throw queue.error;
      if (scheduled.error) throw scheduled.error;

      const rows: UpcomingEmailRow[] = [];

      (batches.data as any[] | null)?.forEach((b) => {
        const start = b.tour?.start_date || b.tour_start_date;
        const days = b.days_before_send ?? b.rule?.days_before_tour ?? 0;
        const due = start
          ? format(addDays(parseISO(start), -days), "yyyy-MM-dd")
          : format(today, "yyyy-MM-dd");
        rows.push({
          key: `batch-${b.id}`,
          source: "scheduled_batch",
          dueAt: due,
          hasTime: false,
          tourId: b.tour_id,
          tourName: b.tour?.name ?? null,
          tourStartDate: start ?? null,
          ruleName: b.rule?.rule_name ?? null,
          templateName:
            b.override_template?.name ?? b.rule?.email_templates?.name ?? null,
          recipientCount: b.booking_count ?? 0,
          status: statusFor(b.approval_status),
        });
      });

      // Group status-change items by rule + batch date + template
      const groups = new Map<string, UpcomingEmailRow>();
      (queue.data as any[] | null)?.forEach((q) => {
        const templateName =
          q.override_template?.name ?? q.rule?.email_templates?.name ?? null;
        const key = `sc-${q.tour_id}-${q.batch_date}-${templateName}-${q.approval_status}`;
        const existing = groups.get(key);
        if (existing) {
          existing.recipientCount += 1;
          return;
        }
        groups.set(key, {
          key,
          source: "status_change",
          dueAt: q.batch_date || format(today, "yyyy-MM-dd"),
          hasTime: false,
          tourId: q.tour_id,
          tourName: q.tour?.name ?? null,
          tourStartDate: q.tour?.start_date ?? null,
          ruleName: q.rule?.rule_name ?? "Status change email",
          templateName,
          recipientCount: 1,
          status: statusFor(q.approval_status),
        });
      });
      groups.forEach((r) => rows.push(r));

      (scheduled.data as any[] | null)?.forEach((s) => {
        rows.push({
          key: `sched-${s.id}`,
          source: "one_off",
          dueAt: s.scheduled_send_at,
          hasTime: true,
          tourId: s.tour_id,
          tourName: s.tour?.name ?? null,
          tourStartDate: s.tour?.start_date ?? null,
          ruleName: "Manually scheduled email",
          templateName: s.email_payload?.templateName || s.email_payload?.subject || null,
          recipientCount: 1,
          status: s.status === "approved" ? "Approved" : "Scheduled",
        });
      });

      // --- 4. Forecast from active automation rules (no record yet)
      if (includeForecast) {
        const [rulesRes, toursRes, sentRes] = await Promise.all([
          supabase
            .from("automated_email_rules")
            .select(
              `id, rule_name, days_before_tour, is_active, trigger_type, email_templates:email_templates(name)`
            )
            .eq("is_active", true)
            // Only date-based rules can be forecast. Event-driven rules
            // (e.g. booking confirmations on status change) have no due date
            // until the triggering event happens.
            .eq("trigger_type", "days_before_tour"),

          (() => {
            let tq = supabase
              .from("tours")
              .select("id, name, start_date, status")
              .gte("start_date", format(today, "yyyy-MM-dd"))
              .not("status", "in", "(cancelled,archived)");
            if (tourId) tq = tq.eq("id", tourId);
            return tq;
          })(),
          supabase
            .from("automated_email_log")
            .select("rule_id, tour_id")
            .not("tour_id", "is", null),
        ]);

        const rules = (rulesRes.data as any[]) || [];
        const tours = (toursRes.data as any[]) || [];
        const existing = new Set(
          ((sentRes.data as any[]) || []).map((r) => `${r.rule_id}-${r.tour_id}`)
        );

        tours.forEach((t) => {
          rules.forEach((r) => {
            if (existing.has(`${r.id}-${t.id}`)) return;
            const due = format(
              addDays(parseISO(t.start_date), -(r.days_before_tour ?? 0)),
              "yyyy-MM-dd"
            );
            if (due < format(today, "yyyy-MM-dd")) return;
            rows.push({
              key: `forecast-${r.id}-${t.id}`,
              source: "forecast",
              dueAt: due,
              hasTime: false,
              tourId: t.id,
              tourName: t.name,
              tourStartDate: t.start_date,
              ruleName: r.rule_name,
              templateName: r.email_templates?.name ?? null,
              recipientCount: 0,
              status: "Forecast",
            });
          });
        });
      }

      const filtered = horizonDate
        ? rows.filter((r) => r.dueAt.slice(0, 10) <= horizonDate)
        : rows;

      filtered.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      return filtered;
    },
  });
};

/** Number of email batches/items awaiting approval — used for the nav badge. */
export const usePendingApprovalCount = () =>
  useQuery({
    queryKey: ["pending-approval-count"],
    staleTime: 60000,
    refetchInterval: 120000,
    queryFn: async () => {
      const [batches, queue] = await Promise.all([
        supabase
          .from("automated_email_log")
          .select("booking_count")
          .eq("approval_status", "pending_approval")
          .is("booking_id", null)
          .not("tour_id", "is", null),
        supabase
          .from("status_change_email_queue")
          .select("id")
          .eq("approval_status", "pending_approval")
          .is("processed_at", null),
      ]);
      const batchCount =
        ((batches.data as any[]) || []).reduce(
          (s, b) => s + (b.booking_count || 0),
          0
        ) || 0;
      return batchCount + (((queue.data as any[]) || []).length || 0);
    },
  });
