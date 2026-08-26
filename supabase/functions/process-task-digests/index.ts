import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultBrand } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";
const TZ = "Australia/Sydney";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const FINISHED = new Set(["completed", "cancelled", "done", "complete", "not_required", "archived"]);

interface Pref {
  user_id: string;
  digest_channel: "off" | "email" | "teams" | "both";
  digest_enabled: boolean;
  digest_cadence: "daily" | "weekly" | "custom_weekdays";
  digest_weekdays: number[];
  digest_time_local: string;
  digest_lookahead_days: number;
  digest_include_overdue: boolean;
  digest_include_due_today: boolean;
  digest_include_upcoming: boolean;
  digest_include_newly_assigned: boolean;
  digest_include_watched: boolean;
  digest_include_subtasks: boolean;
  digest_skip_if_empty: boolean;
  digest_priority_filter: string[];
  scope_assigned: boolean;
  scope_watching: boolean;
  scope_mentioned: boolean;
  last_digest_sent_at: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  status: string;
  tour_id: string | null;
  tour_name?: string | null;
}

function getLocalParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const min = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: wdMap[wd] ?? 1, hour: hr, minute: min };
}

function shouldSendDigest(pref: Pref, now: { weekday: number; hour: number; minute: number }) {
  // Cadence weekday check
  let weekdayMatches = false;
  if (pref.digest_cadence === "daily") weekdayMatches = true;
  else if (pref.digest_cadence === "weekly") weekdayMatches = now.weekday === 1; // Monday
  else weekdayMatches = (pref.digest_weekdays || []).includes(now.weekday);

  if (!weekdayMatches) return false;

  // Time window — must be within current 15-min cron tick of digest_time_local
  const [hStr, mStr] = (pref.digest_time_local || "08:00").split(":");
  const targetMin = parseInt(hStr) * 60 + parseInt(mStr || "0");
  const nowMin = now.hour * 60 + now.minute;
  if (Math.abs(nowMin - targetMin) > 15) return false;

  // Don't double-send within last 6 hours (shorter than daily window so a
  // late-evening send never blocks the next morning's scheduled digest)
  if (pref.last_digest_sent_at) {
    const ageHrs = (Date.now() - new Date(pref.last_digest_sent_at).getTime()) / 3600000;
    if (ageHrs < 6) return false;
  }
  return true;
}

async function getScopedTaskIds(
  supabase: ReturnType<typeof createClient>,
  pref: Pref,
): Promise<{ assigned: Set<string>; watching: Set<string>; mentioned: Set<string> }> {
  const assigned = new Set<string>();
  const watching = new Set<string>();
  const mentioned = new Set<string>();

  if (pref.scope_assigned) {
    const { data } = await supabase
      .from("task_assignments")
      .select("task_id")
      .eq("user_id", pref.user_id);
    (data || []).forEach((r: any) => assigned.add(r.task_id));
  }
  if (pref.scope_watching) {
    const { data } = await supabase
      .from("task_watchers")
      .select("task_id")
      .eq("user_id", pref.user_id);
    (data || []).forEach((r: any) => watching.add(r.task_id));
  }
  if (pref.scope_mentioned) {
    const { data } = await supabase
      .from("task_activity_log")
      .select("task_id")
      .eq("event_type", "mention")
      .ilike("new_value", `%${pref.user_id}%`)
      .limit(1000);
    (data || []).forEach((r: any) => mentioned.add(r.task_id));
  }
  return { assigned, watching, mentioned };
}

function fmtAuDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderTaskList(tasks: TaskRow[]): string {
  if (!tasks.length) return `<p style="color:#9ca3af;font-size:13px;margin:0 0 14px;">None</p>`;
  const rows = tasks
    .map(
      (t) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eef0f3;">
          <a href="${APP_URL}/tasks/${t.id}" style="color:#1a2332;font-weight:600;text-decoration:none;font-size:14px;">${t.title}</a>
          <div style="color:#6b7280;font-size:12px;margin-top:2px;">
            Due: ${fmtAuDate(t.due_date)} · Priority: <span style="text-transform:capitalize;">${t.priority || "—"}</span>${t.tour_name ? ` · Tour: <span style="color:#1a2332;font-weight:500;">${t.tour_name}</span>` : ""}
          </div>
        </td></tr>`,
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f3;border-radius:6px;margin:0 0 18px;background:#fff;">${rows}</table>`;
}

function digestHtml(
  recipientFirstName: string | null,
  sections: { title: string; tasks: TaskRow[] }[],
  lookaheadDays: number,
  headerImg: string,
): string {
  const blocks = sections
    .map(
      (s) =>
        `<h3 style="color:#d4a017;font-size:15px;margin:22px 0 10px;padding:6px 10px;background:#fff8e1;border-left:4px solid #ffd11a;border-radius:3px;text-transform:uppercase;letter-spacing:0.4px;">${s.title} <span style="color:#a07a10;font-weight:500;font-size:12px;">(${s.tasks.length})</span></h3>${renderTaskList(s.tasks)}`,
    )
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family: 'Poppins', Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#232628;padding:20px;text-align:center;"><img src="${headerImg}" alt="" style="height:50px;max-width:300px;" /></td></tr>
<tr><td style="padding:28px 32px;">
<h2 style="color:#1a2332;margin:0 0 6px;font-size:18px;">Hi ${recipientFirstName || "there"},</h2>
<p style="color:#55575d;font-size:14px;margin:0 0 8px;">Here is your task summary covering the next ${lookaheadDays} day${lookaheadDays === 1 ? "" : "s"}.</p>
${blocks}
</td></tr>
<tr><td style="background:#f9fafb;padding:14px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="color:#9ca3af;font-size:11px;margin:0;">Manage your task notification settings in the app.</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let testUserId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.test) {
        const auth = req.headers.get("Authorization") || "";
        if (auth.startsWith("Bearer ")) {
          const token = auth.replace("Bearer ", "");
          const { data: u } = await supabase.auth.getUser(token);
          if (u?.user?.id) testUserId = u.user.id;
        }
        if (!testUserId && body?.user_id) testUserId = String(body.user_id);
      }
    }
  } catch (_) {}

  try {
    const prefsResult = testUserId
      ? await supabase.from("task_notification_preferences").select("*").eq("user_id", testUserId)
      : await supabase
          .from("task_notification_preferences")
          .select("*")
          .eq("digest_enabled", true)
          .neq("digest_channel", "off");
    const prefs = prefsResult.data;
    const prefsErr = prefsResult.error;

    const brand = await getDefaultBrand(supabase);
    const headerImg = brand.headerImageUrl;

    const nowParts = getLocalParts(TZ);
    let sent = 0;
    const debug: any[] = [];
    debug.push({ testUserId, prefsCount: prefs?.length || 0, prefsErr: prefsErr?.message });

    for (const pref of (prefs || []) as Pref[]) {
      if (!testUserId && !shouldSendDigest(pref, nowParts)) continue;

      const { assigned, watching, mentioned } = await getScopedTaskIds(supabase, pref);
      const allIds = new Set<string>([...assigned, ...watching, ...mentioned]);
      debug.push({ user: pref.user_id, assigned: assigned.size, watching: watching.size, mentioned: mentioned.size });
      if (!allIds.size && pref.digest_skip_if_empty && !testUserId) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .eq("id", pref.user_id)
        .maybeSingle();
      if (!profile?.email) {
        debug.push({ user: pref.user_id, skip: "no profile email" });
        continue;
      }

      // Chunk the .in() to avoid URL length limits with many ids
      const idArr = Array.from(allIds);
      const tasks: any[] = [];
      for (let i = 0; i < idArr.length; i += 200) {
        const chunk = idArr.slice(i, i + 200);
        const { data: chunkTasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, title, priority, due_date, status, tour_id, created_at")
          .in("id", chunk);
        if (tErr) debug.push({ taskFetchError: tErr.message });
        if (chunkTasks) tasks.push(...chunkTasks);
      }
      debug.push({ tasksFetched: tasks.length });

      // Hydrate tour names
      const tourIds = Array.from(
        new Set(tasks.map((t: any) => t.tour_id).filter(Boolean) as string[]),
      );
      const tourMap: Record<string, string> = {};
      if (tourIds.length) {
        const { data: tourRows } = await supabase
          .from("tours")
          .select("id, name")
          .in("id", tourIds);
        (tourRows || []).forEach((r: any) => {
          tourMap[r.id] = r.name;
        });
      }
      for (const t of tasks) t.tour_name = t.tour_id ? tourMap[t.tour_id] || null : null;

      const now = Date.now();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const lookaheadEnd = new Date(today);
      lookaheadEnd.setDate(lookaheadEnd.getDate() + 1 + (pref.digest_lookahead_days || 7));
      const lastDigest = pref.last_digest_sent_at ? new Date(pref.last_digest_sent_at) : null;

      const overdue: TaskRow[] = [];
      const dueToday: TaskRow[] = [];
      const upcoming: TaskRow[] = [];
      const newlyAssigned: TaskRow[] = [];
      const watchedOnly: TaskRow[] = [];

      for (const t of (tasks || []) as any[]) {
        if (FINISHED.has(String(t.status).toLowerCase())) continue;
        if (
          pref.digest_priority_filter.length > 0 &&
          !pref.digest_priority_filter.includes((t.priority || "").toLowerCase())
        )
          continue;

        const isAssigned = assigned.has(t.id);
        const isWatchedOnly = !isAssigned && watching.has(t.id);
        const dueMs = t.due_date ? new Date(t.due_date).getTime() : null;

        if (dueMs !== null) {
          if (dueMs < now) {
            if (pref.digest_include_overdue) overdue.push(t);
          } else if (dueMs >= today.getTime() && dueMs < tomorrow.getTime()) {
            if (pref.digest_include_due_today) dueToday.push(t);
          } else if (dueMs >= tomorrow.getTime() && dueMs < lookaheadEnd.getTime()) {
            if (pref.digest_include_upcoming) upcoming.push(t);
          }
        }

        if (
          pref.digest_include_newly_assigned &&
          isAssigned &&
          lastDigest &&
          new Date(t.created_at) > lastDigest
        ) {
          newlyAssigned.push(t);
        }

        if (pref.digest_include_watched && isWatchedOnly) {
          watchedOnly.push(t);
        }
      }

      const sections: { title: string; tasks: TaskRow[] }[] = [];
      if (pref.digest_include_overdue) sections.push({ title: "Overdue", tasks: overdue });
      if (pref.digest_include_due_today) sections.push({ title: "Due today", tasks: dueToday });
      if (pref.digest_include_upcoming)
        sections.push({
          title: `Upcoming (next ${pref.digest_lookahead_days} day${pref.digest_lookahead_days === 1 ? "" : "s"})`,
          tasks: upcoming,
        });
      if (pref.digest_include_newly_assigned)
        sections.push({ title: "Newly assigned to me", tasks: newlyAssigned });
      if (pref.digest_include_watched)
        sections.push({ title: "Watched (non-assigned)", tasks: watchedOnly });

      const total = sections.reduce((s, x) => s + x.tasks.length, 0);
      debug.push({ overdue: overdue.length, dueToday: dueToday.length, upcoming: upcoming.length, newlyAssigned: newlyAssigned.length, watchedOnly: watchedOnly.length, total });
      if (total === 0 && pref.digest_skip_if_empty && !testUserId) continue;

      const html = digestHtml(profile.first_name, sections, pref.digest_lookahead_days, headerImg);
      const subject = `Your task digest — ${total} item${total === 1 ? "" : "s"}`;

      const wantEmail = pref.digest_channel === "email" || pref.digest_channel === "both";
      const wantTeams = pref.digest_channel === "teams" || pref.digest_channel === "both";

      let delivered = false;
      if (wantEmail) {
        try {
          const { error, data: rd } = await resend.emails.send({
            from: "Australian Racing Tours <info@australianracingtours.com.au>",
            to: [profile.email],
            subject,
            html,
          });
          if (!error) delivered = true;
          else debug.push({ resendError: JSON.stringify(error) });
          debug.push({ resendData: rd });
        } catch (e) {
          debug.push({ resendException: String(e) });
        }
      }
      if (wantTeams) {
        try {
          await supabase.functions.invoke("send-teams-notification", {
            body: {
              type: "assignment",
              taskId: (tasks?.[0] as any)?.id || "00000000-0000-0000-0000-000000000000",
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
        sent++;
        // Test sends must not update last_digest_sent_at, otherwise the
        // anti-duplicate guard can suppress the next scheduled digest.
        if (!testUserId) {
          await supabase
            .from("task_notification_preferences")
            .update({ last_digest_sent_at: new Date().toISOString() })
            .eq("user_id", pref.user_id);
        }
        await supabase.from("task_notification_log").insert({
          user_id: pref.user_id,
          task_id: "00000000-0000-0000-0000-000000000000",
          kind: "digest",
          threshold_hours: total,
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(
      JSON.stringify({ success: true, sent, summary: testUserId ? `Test digest: ${sent === 1 ? "sent" : "FAILED to send"} — see debug` : `${sent} digest(s) sent`, debug }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("process-task-digests error", e);
    return new Response(JSON.stringify({ error: e.message || "Unexpected" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});