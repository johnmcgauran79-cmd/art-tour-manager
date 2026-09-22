import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ReminderKind = "deposit" | "instalment" | "final";

export interface InstalmentReminder {
  id: string;
  kind: ReminderKind;
  tour_id: string;
  xero_invoice_id: string;
  xero_invoice_number: string | null;
  booking_ids: string[];
  pax_count: number;
  currency_code: string;
  invoice_total: number;
  amount_paid: number;
  amount_due: number;
  instalment_expected: number;
  deposit_expected: number;
  shortfall: number;
  invoice_due_date: string | null;
  invoice_date: string | null;
  booked_at: string | null;
  final_payment_date: string | null;
  line_items: Array<{ description: string; quantity: number; unit_amount: number; line_amount: number }> | null;
  auto_send: boolean;
  escalated_at: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  payment_link: string | null;
  state: "pending" | "sent" | "held_agent" | "needs_call" | "stopped" | "resolved";
  hold_reason: string | null;
  stop_reason: string | null;
  reminder_count: number;
  last_sent_at: string | null;
  next_due_at: string | null;
  send_error: string | null;
  created_at: string;
  tour?: { id: string; name: string | null; start_date: string | null; final_payment_date: string | null } | null;
}

export const useInstalmentReminders = () =>
  useQuery({
    queryKey: ["instalment-reminders"],
    queryFn: async (): Promise<InstalmentReminder[]> => {
      const { data, error } = await supabase
        .from("instalment_reminders")
        .select("*, tour:tours ( id, name, start_date, final_payment_date )")
        .in("state", ["pending", "sent", "held_agent", "needs_call", "stopped"])
        .order("next_due_at", { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
    refetchOnWindowFocus: false,
  });

export const useInstalmentReminderDueCount = () =>
  useQuery({
    queryKey: ["instalment-reminders-due-count"],
    queryFn: async () => {
      // Only rows a person must action: first approval, agent invoices, and
      // invoices that need a phone call. Automatic follow-ups are not counted.
      const { count, error } = await supabase
        .from("instalment_reminders")
        .select("id", { count: "exact", head: true })
        .in("state", ["pending", "held_agent", "needs_call"]);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 120_000,
  });

type Action = "send" | "skip" | "stop" | "resume" | "pause_auto" | "remove";

export const useInstalmentReminderAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action, reason }: { ids: string[]; action: Action; reason?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("send-instalment-reminders", {
        body: { reminder_ids: ids, action, reason: reason || null, actor_id: userRes?.user?.id || null },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error((data as any)?.error || "Action failed");
      return data as { sent?: number; errors?: number; count?: number };
    },
    onSuccess: (data, vars) => {
      const label =
        vars.action === "send"
          ? `${data.sent ?? 0} reminder(s) sent${data.errors ? ` · ${data.errors} error(s)` : ""}`
          : vars.action === "skip"
            ? "Pushed back a week"
            : vars.action === "stop"
              ? "Reminders stopped"
              : vars.action === "remove"
                ? "Removed from the list"
                : vars.action === "pause_auto"
                  ? "Automatic sending paused"
                  : "Reminders resumed";
      toast({ title: "Done", description: label, variant: data.errors ? "destructive" : "default" });
      qc.invalidateQueries({ queryKey: ["instalment-reminders"] });
      qc.invalidateQueries({ queryKey: ["instalment-reminders-due-count"] });
    },
    onError: (e: any) => {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    },
  });
};

export const useSendTestReminder = () =>
  useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke("send-instalment-reminders", {
        body: { reminder_ids: [id], action: "send", test_mode: true, override_recipient_email: email },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error((data as any)?.error || "Test send failed");
      if ((data as any)?.sent === 0) throw new Error("Nothing was sent — check the email template is active.");
      return data as { sent?: number };
    },
    onSuccess: (_d, vars) => {
      toast({ title: "Test sent", description: `A copy is on its way to ${vars.email}.` });
    },
    onError: (e: any) => {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    },
  });

export interface ReminderIssue {
  kind: ReminderKind;
  tour_name: string | null;
  client: string | null;
  invoice_number?: string | null;
  invoice_reference?: string | null;
  reason: string;
}

/** Explanations from the last Xero check: bookings deliberately not chased. */
export const useReminderIssues = () =>
  useQuery<ReminderIssue[]>({
    queryKey: ["instalment-reminder-issues"],
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const useRefreshInstalmentReminders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("queue-instalment-reminders", { body: {} });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error((data as any)?.error || "Refresh failed");
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Checked against Xero",
        description: `${data.queued} new · ${data.updated} updated · ${data.resolved} paid · ${data.auto_sent ?? 0} sent automatically · ${data.flagged_for_call ?? 0} for a phone call · ${data.held_agent} held for a manual check`,
      });
      qc.setQueryData(["instalment-reminder-issues"], (data.not_chased ?? []) as ReminderIssue[]);
      qc.invalidateQueries({ queryKey: ["instalment-reminders"] });
      qc.invalidateQueries({ queryKey: ["instalment-reminders-due-count"] });
    },
    onError: (e: any) => {
      toast({ title: "Could not check Xero", description: e.message, variant: "destructive" });
    },
  });
};
