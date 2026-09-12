import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultBrand } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";
const TZ = "Australia/Brisbane";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Health {
  generated_at: string;
  stale_backup_hours: number | null;
  failed_jobs_24h: Array<{ jobname: string; failures: number; message: string }>;
  http_failures_24h: number;
  mailbox_failures: Array<{ mailbox: string; status: string | null; error: string }>;
  xero_failures_24h: number;
  crm_failures_24h: number;
  marketing_failures_24h: number;
  email_failures_24h: number;
}

const STALE_BACKUP_HOURS = 36;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildProblems(h: Health): string[] {
  const out: string[] = [];

  if (h.stale_backup_hours === null) {
    out.push("No database backup has ever been reported. Backups are not confirmed as working.");
  } else if (h.stale_backup_hours > STALE_BACKUP_HOURS) {
    out.push(`Last successful database backup was ${Math.round(h.stale_backup_hours)} hours ago.`);
  }

  for (const j of h.failed_jobs_24h || []) {
    out.push(
      `Scheduled job “${esc(j.jobname)}” failed ${j.failures} time(s) in the last 24 hours.` +
        (j.message ? ` Last message: ${esc(j.message)}` : ""),
    );
  }

  if (h.http_failures_24h > 0) {
    out.push(
      `${h.http_failures_24h} scheduled call(s) to background services returned an error in the last 24 hours.`,
    );
  }

  for (const m of h.mailbox_failures || []) {
    out.push(
      `Mailbox ${esc(m.mailbox)} last sync did not succeed (${esc(m.status || "unknown")}).` +
        (m.error ? ` ${esc(m.error)}` : ""),
    );
  }

  if (h.xero_failures_24h > 0) out.push(`${h.xero_failures_24h} Xero sync error(s) in the last 24 hours.`);
  if (h.crm_failures_24h > 0) out.push(`${h.crm_failures_24h} CRM automation failure(s) in the last 24 hours.`);
  if (h.marketing_failures_24h > 0)
    out.push(`${h.marketing_failures_24h} marketing automation failure(s) in the last 24 hours.`);
  if (h.email_failures_24h > 0) out.push(`${h.email_failures_24h} email(s) failed to send in the last 24 hours.`);

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const previewOnly = body?.preview === true;
    const overrideTo: string[] | undefined = Array.isArray(body?.to) ? body.to : undefined;

    const { data, error } = await supabase.rpc("get_system_health_service");
    if (error) throw new Error(`Health check failed: ${error.message}`);
    const health = data as Health;

    const problems = buildProblems(health);
    console.log(`[System Health] ${problems.length} problem(s) detected.`);

    if (previewOnly) return json({ success: true, problems, health });

    if (problems.length === 0 && !force) {
      return json({ success: true, sent: false, reason: "No problems detected", problems: [] });
    }

    let recipients = overrideTo;
    if (!recipients) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin"]);
      const ids = (admins || []).map((a: { user_id: string }) => a.user_id);
      if (ids.length === 0) return json({ success: true, sent: false, reason: "No admin recipients" });
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", ids);
      recipients = (profiles || [])
        .map((p: { email: string | null }) => (p.email || "").trim())
        .filter((e: string) => e.includes("@"));
    }

    if (!recipients || recipients.length === 0) {
      return json({ success: true, sent: false, reason: "No admin email addresses found" });
    }

    const brand = await getDefaultBrand(supabase).catch(() => null);
    const fromName = brand?.senderName || brand?.name || "Australian Racing Tours";
    const fromEmail = brand?.fromEmailOperational || "info@australianracingtours.com.au";

    const stamp = new Date().toLocaleString("en-AU", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject =
      problems.length === 0
        ? `System health: all clear (${stamp})`
        : `System health: ${problems.length} issue${problems.length === 1 ? "" : "s"} need attention (${stamp})`;

    const listHtml =
      problems.length === 0
        ? `<p style="margin:0;color:#166534;font-weight:600">No problems detected in the last 24 hours.</p>`
        : `<ul style="margin:0;padding-left:20px">${problems
            .map((p) => `<li style="margin-bottom:8px">${p}</li>`)
            .join("")}</ul>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5">
  <div style="width:100%;background:#f5f5f5;padding:24px 12px">
    <div style="max-width:800px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;font-family:Poppins,Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">
      <h1 style="font-family:Larken,Georgia,serif;font-size:24px;margin:0 0 4px">Daily system health</h1>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px">${esc(stamp)} (Brisbane time)</p>
      ${listHtml}
      <p style="margin:24px 0 0"><a href="${APP_URL}/settings" style="background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Open System Health in ART Admin</a></p>
      <p style="margin:20px 0 0;color:#6b7280;font-size:12px">This digest is sent automatically each morning. It only lists things that look wrong.</p>
    </div>
  </div>
</body></html>`;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const sent: string[] = [];
    const failed: Array<{ to: string; error: string }> = [];

    for (const to of recipients) {
      try {
        const res = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
        });
        if ((res as { error?: { message?: string } })?.error) {
          failed.push({ to, error: (res as { error: { message?: string } }).error.message || "send failed" });
        } else {
          sent.push(to);
        }
      } catch (e) {
        failed.push({ to, error: e instanceof Error ? e.message : String(e) });
      }
      // Resend allows 2 requests/second — stay well under it.
      await new Promise((r) => setTimeout(r, 600));
    }

    return json({ success: true, sent: sent.length, failed, problems });
  } catch (e) {
    console.error("[System Health] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
