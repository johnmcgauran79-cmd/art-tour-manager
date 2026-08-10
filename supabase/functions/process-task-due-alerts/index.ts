import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface Pref {
  user_id: string;
  alerts_channel: "off" | "email" | "teams" | "both";
  alerts_enabled: boolean;
  alert_thresholds_hours: number[];
  alert_on_overdue: boolean;
  overdue_reminder_interval_hours: number;
  alert_priority_filter: string[];
  scope_assigned: boolean;
  scope_watching: boolean;
  scope_mentioned: boolean;
}

interface TaskRow {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  status: string;
}

const FINISHED = new Set(["completed", "cancelled", "done", "complete", "not_required", "archived"]);

function isWithinWindow(dueIso: string, hoursBefore: number, windowMinutes: number) {
  const due = new Date(dueIso).getTime();
  const target = due - hoursBefore * 3600 * 1000;
  const now = Date.now();
  return now >= target && now < target + windowMinutes * 60 * 1000;
}

async function getScopedTaskIds(
  supabase: ReturnType<typeof createClient>,
  pref: Pref,
): Promise<Set<string>> {
  const ids = new Set<string>();

  if (pref.scope_assigned) {
    const { data } = await supabase
      .from("task_assignments")
      .select("task_id")
      .eq("user_id", pref.user_id);
    (data || []).forEach((r: any) => ids.add(r.task_id));
  }
  if (pref.scope_watching) {
    const { data } = await supabase
      .from("task_watchers")
      .select("task_id")
      .eq("user_id", pref.user_id);
    (data || []).forEach((r: any) => ids.add(r.task_id));
  }
  if (pref.scope_mentioned) {
    // Best-effort: derive from task_activity_log mention events for this user
    const { data } = await supabase
      .from("task_activity_log")
      .select("task_id, new_value")
      .eq("event_type", "mention")
      .ilike("new_value", `%${pref.user_id}%`)
      .limit(1000);
    (data || []).forEach((r: any) => ids.add(r.task_id));
  }
  return ids;
}

function alertSubject(task: TaskRow, kind: string, hoursBefore?: number): string {
  if (kind === "overdue") return `OVERDUE: ${task.title}`;
  if (hoursBefore === 24) return `Due tomorrow: ${task.title}`;
  if (hoursBefore && hoursBefore < 24) return `Due in ${hoursBefore}h: ${task.title}`;
  if (hoursBefore && hoursBefore >= 24) {
    const days = Math.round(hoursBefore / 24);
    return `Due in ${days} day${days === 1 ? "" : "s"}: ${task.title}`;
  }
  return `Task reminder: ${task.title}`;
}

function alertHtml(
  recipientFirstName: string | null,
  task: TaskRow,
  kind: string,
  headerImg: string,
  hoursBefore?: number,
): string {
  const url = `${APP_URL}/tasks/${task.id}`;
  const dueStr = task.due_date
    ? new Date(task.due_date).toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const heading =
    kind === "overdue"
      ? "This task is overdue"
      : hoursBefore === 24
      ? "This task is due in 24 hours"
      : hoursBefore && hoursBefore < 24
      ? `This task is due in ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}`
      : hoursBefore
      ? `This task is due in ${Math.round(hoursBefore / 24)} day${Math.round(hoursBefore / 24) === 1 ? "" : "s"}`
      : "Task reminder";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#232628;padding:20px;text-align:center;"><img src="${headerImg}" alt="" style="height:50px;max-width:300px;" /></td></tr>
<tr><td style="padding:28px 32px;">
<h2 style="color:#1a2332;margin:0 0 6px;font-size:18px;">Hi ${recipientFirstName || "there"},</h2>
<p style="color:#55575d;font-size:14px;margin:0 0 14px;">${heading}.</p>
<p style="margin:0 0 4px;color:#1a2332;font-size:16px;font-weight:600;">${task.title}</p>
<p style="margin:0 0 4px;color:#55575d;font-size:13px;">Due: <strong>${dueStr}</strong></p>
${task.priority ? `<p style="margin:0 0 14px;color:#55575d;font-size:13px;">Priority: <strong style="text-transform:capitalize;">${task.priority}</strong></p>` : ""}
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 0;">
<a href="${url}" style="display:inline-block;background:#1a2332;color:#f5c518;text-decoration:none;padding:11px 26px;border-radius:6px;font-size:14px;font-weight:600;">OPEN TASK</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f9fafb;padding:14px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="color:#9ca3af;font-size:11px;margin:0;">You can change task notification settings in the app.</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: prefs } = await supabase
      .from("task_notification_preferences")
      .select("*")
      .eq("alerts_enabled", true)
      .neq("alerts_channel", "off");

    const { data: headerSetting } = await supabase
      .from("general_settings")
      .select("setting_value")
      .eq("setting_key", "email_header_image_url")
      .maybeSingle();
    const headerImg =
      (headerSetting?.setting_value as string) ||
      "https://art-tour-manager.lovable.app/images/email-header-default.png";

    const WINDOW_MIN = 20; // cron runs every 15 min, allow a touch of slack
    let totalSent = 0;
    const errors: string[] = [];

    for (const pref of (prefs || []) as Pref[]) {
      const taskIds = await getScopedTaskIds(supabase, pref);
      if (!taskIds.size) continue;

      // Fetch profile (recipient email)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .eq("id", pref.user_id)
        .single();
      if (!profile?.email) continue;

      // Fetch tasks
      const ids = Array.from(taskIds);
      const tasks: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: chunkTasks } = await supabase
          .from("tasks")
          .select("id, title, priority, due_date, status")
          .in("id", chunk)
          .not("due_date", "is", null);
        if (chunkTasks) tasks.push(...chunkTasks);
      }

      const candidates: { task: TaskRow; kind: string; hours?: number }[] = [];
      for (const t of (tasks || []) as TaskRow[]) {
        if (FINISHED.has(String(t.status).toLowerCase())) continue;
        if (
          pref.alert_priority_filter.length > 0 &&
          !pref.alert_priority_filter.includes((t.priority || "").toLowerCase())
        )
          continue;
        if (!t.due_date) continue;
        const dueMs = new Date(t.due_date).getTime();
        const now = Date.now();

        if (dueMs < now) {
          if (pref.alert_on_overdue) candidates.push({ task: t, kind: "overdue" });
        } else {
          for (const h of pref.alert_thresholds_hours || []) {
            if (isWithinWindow(t.due_date, h, WINDOW_MIN)) {
              candidates.push({ task: t, kind: "due_alert", hours: h });
            }
          }
        }
      }

      for (const c of candidates) {
        // Dedupe via log
        if (c.kind === "due_alert") {
          const { data: existing } = await supabase
            .from("task_notification_log")
            .select("id")
            .eq("user_id", pref.user_id)
            .eq("task_id", c.task.id)
            .eq("kind", "due_alert")
            .eq("threshold_hours", c.hours)
            .limit(1);
          if (existing && existing.length) continue;
        } else if (c.kind === "overdue") {
          const { data: last } = await supabase
            .from("task_notification_log")
            .select("sent_at")
            .eq("user_id", pref.user_id)
            .eq("task_id", c.task.id)
            .eq("kind", "overdue_reminder")
            .order("sent_at", { ascending: false })
            .limit(1);
          if (last && last.length) {
            const ageHrs = (Date.now() - new Date(last[0].sent_at).getTime()) / 3600000;
            if (ageHrs < pref.overdue_reminder_interval_hours) continue;
          }
        }

        const subject = alertSubject(c.task, c.kind, c.hours);
        const html = alertHtml(profile.first_name, c.task, c.kind, headerImg, c.hours);

        const wantEmail = pref.alerts_channel === "email" || pref.alerts_channel === "both";
        const wantTeams = pref.alerts_channel === "teams" || pref.alerts_channel === "both";

        let delivered = false;
        if (wantEmail) {
          try {
            const { error } = await resend.emails.send({
              from: "Australian Racing Tours <info@australianracingtours.com.au>",
              to: [profile.email],
              subject,
              html,
            });
            if (!error) delivered = true;
            else console.error("resend error", profile.email, error);
          } catch (e) {
            console.error("resend exception", e);
          }
        }
        if (wantTeams) {
          // Best-effort: invoke Teams notif using the recipient as their own actor.
          // If they have no Teams connection, this no-ops and we already sent email (or fall back next cycle).
          try {
            await supabase.functions.invoke("send-teams-notification", {
              body: {
                type: "assignment",
                taskId: c.task.id,
                recipientUserIds: [pref.user_id],
                actorUserId: pref.user_id,
                message: subject,
              },
            });
            delivered = true;
          } catch (e) {
            console.error("teams invoke failed", e);
          }
        }

        if (delivered) {
          totalSent++;
          await supabase.from("task_notification_log").insert({
            user_id: pref.user_id,
            task_id: c.task.id,
            kind: c.kind === "overdue" ? "overdue_reminder" : "due_alert",
            threshold_hours: c.hours ?? null,
          });
        }
        await new Promise((r) => setTimeout(r, 300)); // pacing for Resend
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-task-due-alerts error", e);
    return new Response(JSON.stringify({ error: e.message || "Unexpected" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});