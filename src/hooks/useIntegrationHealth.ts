import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Integration status panel data.
 *
 * Read-only: opening the page never triggers a sync. Every figure comes from
 * the existing settings/log tables.
 */

export type IntegrationState = "connected" | "degraded" | "disconnected" | "unknown";

export interface IntegrationStatus {
  id: string;
  name: string;
  state: IntegrationState;
  headline: string;
  lastActivityAt?: string | null;
  lastError?: string | null;
  metrics: { label: string; value: string | number }[];
  fixLink?: { label: string; to: string };
}

const since = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

export const useIntegrationHealth = () =>
  useQuery({
    queryKey: ["integration-health"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<IntegrationStatus[]> => {
      const day = since(24);
      const week = since(24 * 7);

      const [
        xeroSettings,
        xeroLog,
        xeroReceipts,
        wpLinks,
        wpLogs,
        emailLogs,
        suppressions,
        stuckScheduled,
        teamsConnections,
        teamsConfig,
        autoEmailPending,
        autoReportLog,
      ] = await Promise.all([
        supabase.from("xero_integration_settings").select("tenant_name, is_connected, token_expires_at, last_contact_sync_at, updated_at").maybeSingle(),
        supabase.from("xero_sync_log").select("status, error_message, created_at, sync_type").gte("created_at", week).order("created_at", { ascending: false }).limit(200),
        supabase.from("xero_payment_receipts").select("id", { count: "exact", head: true }).eq("approval_status", "pending").is("receipt_email_sent_at", null),
        supabase.from("wordpress_tour_links").select("tour_id, wp_tour_id, last_synced_at").limit(500),
        supabase.from("wordpress_integration_audit_logs").select("result_status, error_message, created_at, action").gte("created_at", week).order("created_at", { ascending: false }).limit(200),
        supabase.from("email_logs").select("id, error_message, sent_at").gte("created_at", day).limit(1000),
        supabase.from("email_suppressions").select("id, is_active").eq("is_active", true).limit(1000),
        supabase.from("scheduled_emails").select("id, scheduled_send_at, status").eq("status", "approved").lt("scheduled_send_at", since(1)).limit(200),
        supabase.from("user_teams_connections").select("id, ms_display_name, connected_at").limit(100),
        supabase.from("teams_channel_notify_config").select("enabled, channel_name, chat_name, updated_at").maybeSingle(),
        supabase.from("status_change_email_queue").select("id, triggered_at, approval_status").eq("approval_status", "pending").lt("triggered_at", since(24)).limit(500),
        supabase.from("automated_report_log").select("status, error_message, sent_at").gte("sent_at", week).order("sent_at", { ascending: false }).limit(200),
      ]);

      // Keap has no sync-log table; health is measured by contact match coverage.
      const [keapMatched, keapTotal] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).not("keap_contact_id", "is", null),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);

      const results: IntegrationStatus[] = [];

      // --- Xero -------------------------------------------------------------
      const xero = xeroSettings.data as any;
      const xeroRows = (xeroLog.data as any[]) || [];
      const xeroFailures = xeroRows.filter((r) => r.status === "error" || r.status === "failed");
      // Xero access tokens are short-lived (30 min) and refreshed automatically on
      // the next API call, so an expired access token is NOT a problem. Only the
      // refresh token expiring (no successful token activity for ~55 days) means a
      // reconnect is genuinely required.
      const xeroLastTouch = xero?.updated_at ?? xero?.last_contact_sync_at ?? null;
      const refreshExpired = xeroLastTouch
        ? new Date(xeroLastTouch).getTime() < Date.now() - 55 * 24 * 3600_000
        : false;
      // Only receipts genuinely awaiting approval count here — "skipped" (no
      // recipient email) and "rejected" receipts are never going to be sent.
      const pendingReceipts = (xeroReceipts as any).count ?? 0;
      results.push({
        id: "xero",
        name: "Xero",
        state: !xero?.is_connected ? "disconnected" : refreshExpired || xeroFailures.length > 0 ? "degraded" : "connected",
        headline: !xero?.is_connected
          ? "Not connected"
          : refreshExpired
          ? "Reconnect required — Xero authorisation has lapsed"
          : xeroFailures.length > 0
          ? `${xeroFailures.length} sync error(s) in the last 7 days`
          : `Connected to ${xero?.tenant_name || "Xero"}`,
        lastActivityAt: xero?.last_contact_sync_at ?? xeroRows[0]?.created_at ?? null,
        lastError: xeroFailures[0]?.error_message ?? null,
        metrics: [
          { label: "Sync events (7d)", value: xeroRows.length },
          { label: "Errors (7d)", value: xeroFailures.length },
          { label: "Receipts awaiting send", value: unsentReceipts.length >= 200 ? "200+" : unsentReceipts.length },
        ],
        fixLink: { label: "Xero settings", to: "/?tab=settings" },
      });

      // --- WordPress --------------------------------------------------------
      const links = (wpLinks.data as any[]) || [];
      const wpRows = (wpLogs.data as any[]) || [];
      const wpFailures = wpRows.filter((r) => r.result_status && r.result_status !== "success");
      results.push({
        id: "wordpress",
        name: "WordPress",
        state: links.length === 0 ? "disconnected" : wpFailures.length > 0 ? "degraded" : "connected",
        headline:
          links.length === 0
            ? "No tours linked to the website"
            : wpFailures.length > 0
            ? `${wpFailures.length} publish failure(s) in the last 7 days`
            : `${links.length} tour(s) linked`,
        lastActivityAt: wpRows[0]?.created_at ?? null,
        lastError: wpFailures[0]?.error_message ?? null,
        metrics: [
          { label: "Linked tours", value: links.length },
          { label: "API calls (7d)", value: wpRows.length },
          { label: "Failures (7d)", value: wpFailures.length },
        ],
        fixLink: { label: "Website (WP)", to: "/wordpress-content" },
      });

      // --- Email (Resend) ---------------------------------------------------
      const sent = (emailLogs.data as any[]) || [];
      const failed = sent.filter((r) => r.error_message);
      const stuck = ((stuckScheduled.data as any[]) || []).length;
      results.push({
        id: "email",
        name: "Email (Resend)",
        state: failed.length > 0 || stuck > 0 ? "degraded" : "connected",
        headline:
          stuck > 0
            ? `${stuck} scheduled email(s) past their send time`
            : failed.length > 0
            ? `${failed.length} send failure(s) in the last 24 hours`
            : `${sent.length} email(s) sent in the last 24 hours`,
        lastActivityAt: sent[0]?.sent_at ?? null,
        lastError: failed[0]?.error_message ?? null,
        metrics: [
          { label: "Sent (24h)", value: sent.length },
          { label: "Failures (24h)", value: failed.length },
          { label: "Active suppressions", value: ((suppressions.data as any[]) || []).length },
          { label: "Stuck in schedule", value: stuck },
        ],
        fixLink: { label: "Communications", to: "/communications" },
      });

      // --- Microsoft Teams --------------------------------------------------
      const teamsUsers = ((teamsConnections.data as any[]) || []).length;
      const cfg = teamsConfig.data as any;
      const target = cfg?.channel_name || cfg?.chat_name;
      results.push({
        id: "teams",
        name: "Microsoft Teams",
        state: teamsUsers === 0 ? "disconnected" : !cfg?.enabled || !target ? "degraded" : "connected",
        headline:
          teamsUsers === 0
            ? "No staff account connected"
            : !cfg?.enabled
            ? "Channel notifications disabled"
            : !target
            ? "No channel or chat selected"
            : `Posting to ${target}`,
        lastActivityAt: cfg?.updated_at ?? null,
        metrics: [
          { label: "Connected users", value: teamsUsers },
          { label: "Notifications", value: cfg?.enabled ? "Enabled" : "Disabled" },
        ],
        fixLink: { label: "Teams settings", to: "/?tab=settings" },
      });

      // --- Automations ------------------------------------------------------
      const staleApprovals = ((autoEmailPending.data as any[]) || []).length;
      const reportRows = (autoReportLog.data as any[]) || [];
      const reportFailures = reportRows.filter((r) => r.status && r.status !== "sent" && r.status !== "success");
      results.push({
        id: "automations",
        name: "Automations",
        state: staleApprovals > 0 || reportFailures.length > 0 ? "degraded" : "connected",
        headline:
          staleApprovals > 0
            ? `${staleApprovals} email approval(s) waiting over 24 hours`
            : reportFailures.length > 0
            ? `${reportFailures.length} report send failure(s) in the last 7 days`
            : "Queues clear",
        lastActivityAt: reportRows[0]?.sent_at ?? null,
        lastError: reportFailures[0]?.error_message ?? null,
        metrics: [
          { label: "Stale approvals", value: staleApprovals },
          { label: "Reports sent (7d)", value: reportRows.length },
          { label: "Report failures (7d)", value: reportFailures.length },
        ],
        fixLink: { label: "Communications", to: "/communications" },
      });

      // --- Keap -------------------------------------------------------------
      const matched = keapMatched.count || 0;
      const total = keapTotal.count || 0;
      const coverage = total > 0 ? Math.round((matched / total) * 100) : 0;
      results.push({
        id: "keap",
        name: "Keap",
        state: total === 0 ? "unknown" : coverage >= 90 ? "connected" : coverage >= 50 ? "degraded" : "disconnected",
        headline:
          total === 0
            ? "No contacts to sync"
            : `${coverage}% of contacts matched to a Keap record`,
        metrics: [
          { label: "Matched contacts", value: matched },
          { label: "Unmatched contacts", value: Math.max(0, total - matched) },
        ],
        fixLink: { label: "Contacts", to: "/?tab=contacts" },
      });

      return results;
    },
  });
