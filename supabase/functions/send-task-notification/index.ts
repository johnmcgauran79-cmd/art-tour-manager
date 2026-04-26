import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "mention" | "assignment" | "subtask_assignment";
  taskId: string;
  recipientUserIds: string[];
  actorUserId: string;
  message?: string;
}

const APP_URL = "https://art-tour-manager.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as NotificationRequest;
    if (!body.type || !body.taskId || !body.recipientUserIds?.length || !body.actorUserId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve task
    const { data: task } = await supabase
      .from("tasks").select("id, title, priority, due_date").eq("id", body.taskId).single();
    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve actor
    const { data: actor } = await supabase
      .from("profiles").select("first_name, last_name, email").eq("id", body.actorUserId).single();
    const actorName = actor
      ? `${actor.first_name || ""} ${actor.last_name || ""}`.trim() || actor.email
      : "Someone";

    // Resolve recipients (dedupe) and exclude the actor — users should never be
    // notified about their own actions (self-assignment, self-mention, self-reply).
    const recipientIds = Array.from(new Set(body.recipientUserIds)).filter(
      (id) => id !== body.actorUserId
    );
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allRecipients } = await supabase
      .from("profiles")
      .select("id, first_name, email, notification_preference")
      .in("id", recipientIds);

    // Split by notification_preference. Default 'teams' if unset.
    const teamsRecipientIds: string[] = [];
    const emailRecipients: typeof allRecipients = [];
    for (const r of allRecipients || []) {
      const pref = (r as any).notification_preference || "teams";
      if (pref === "teams" || pref === "both") teamsRecipientIds.push(r.id);
      if (pref === "email" || pref === "both") emailRecipients.push(r);
    }

    // Fire Teams notifications. Any recipients that fail (no Teams ID, etc.) fall back to email.
    let teamsFallbackIds: string[] = [];
    if (teamsRecipientIds.length > 0) {
      try {
        const { data: teamsResult } = await supabase.functions.invoke("send-teams-notification", {
          body: {
            type: body.type,
            taskId: body.taskId,
            recipientUserIds: teamsRecipientIds,
            actorUserId: body.actorUserId,
            message: body.message,
          },
        });
        teamsFallbackIds = (teamsResult?.fallback as string[] | undefined) || [];
      } catch (err) {
        console.error("send-teams-notification invocation failed, falling back to email:", err);
        teamsFallbackIds = teamsRecipientIds;
      }
    }

    // Build the final email recipient set (preference=email/both + teams fallbacks)
    const emailRecipientIds = new Set(emailRecipients.map((r) => r.id));
    for (const id of teamsFallbackIds) emailRecipientIds.add(id);
    const recipients = (allRecipients || []).filter((r) => emailRecipientIds.has(r.id));

    // Header image
    const { data: headerSetting } = await supabase
      .from("general_settings").select("setting_value").eq("setting_key", "email_header_image_url").maybeSingle();
    const emailHeaderImageUrl = (headerSetting?.setting_value as string) ||
      "https://art-tour-manager.lovable.app/images/email-header-default.png";

    const subjectLine =
      body.type === "mention"
        ? `${actorName} mentioned you on a task`
        : body.type === "subtask_assignment"
        ? `${actorName} assigned you a subtask`
        : `${actorName} assigned you a task`;

    const bodyHeading =
      body.type === "mention"
        ? "You were mentioned in a comment"
        : body.type === "subtask_assignment"
        ? "You have been assigned a subtask"
        : "You have been assigned a new task";

    const taskUrl = `${APP_URL}/tasks/${task.id}`;
    const dueLine = task.due_date
      ? `<p style="margin:0 0 8px;color:#55575d;font-size:14px;">Due: <strong>${new Date(task.due_date).toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}</strong></p>`
      : "";

    // For subtask assignments, the message field carries the subtask title and
    // is shown as a labelled line rather than a quote block.
    const subtaskTitle = body.type === "subtask_assignment" ? (body.message || "").trim() : "";

    // Strip @[Name](uuid) mention syntax → @Name AND [[type:id|Label]] entity tokens → Label
    const cleanedMessage = body.message
      ? (body.type === "subtask_assignment" ? "" : body.message
          .replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
          .replace(
            /\[\[(?:booking|hotel|activity|tour|contact):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\|([^\]]*))?\]\]/gi,
            (_m, label) => (label || "").trim() || "(linked record)"
          ))
      : "";
    const messageBlock = cleanedMessage
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-left:3px solid #1a2332;border-radius:4px;margin:16px 0;"><tr><td style="padding:14px 18px;color:#374151;font-size:14px;font-style:italic;line-height:1.5;">"${cleanedMessage.replace(/</g, "&lt;").substring(0, 500)}"</td></tr></table>`
      : "";

    const subtaskBlock = subtaskTitle
      ? `<p style="margin:0 0 8px;color:#55575d;font-size:14px;">Subtask: <strong>${subtaskTitle.replace(/</g, "&lt;").substring(0, 300)}</strong></p>`
      : "";

    let sent = 0;
    for (const r of recipients || []) {
      if (!r.email) continue;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background-color:#232628;padding:24px;text-align:center;">
<img src="${emailHeaderImageUrl}" alt="Australian Racing Tours" style="height:60px;max-width:320px;width:auto;" />
</td></tr>
<tr><td style="padding:32px 36px;">
<h2 style="color:#1a2332;margin:0 0 8px;font-size:18px;">Hi ${r.first_name || "there"},</h2>
<p style="color:#55575d;font-size:15px;line-height:1.6;margin:0 0 18px;"><strong>${actorName}</strong> ${body.type === "mention" ? "mentioned you in a comment on" : body.type === "subtask_assignment" ? "assigned you a subtask on" : "assigned you to"} the task below.</p>
<h3 style="color:#1a2332;margin:0 0 8px;font-size:17px;">${bodyHeading}</h3>
<p style="margin:0 0 4px;color:#1a2332;font-size:16px;font-weight:600;">${task.title}</p>
${dueLine}
${subtaskBlock}
${messageBlock}
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 0;">
<a href="${taskUrl}" style="display:inline-block;background-color:#1a2332;color:#f5c518;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">OPEN TASK</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:16px;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Automated notification from Australian Racing Tours.</p>
</td></tr></table></td></tr></table></body></html>`;

      const { data: sendData, error } = await resend.emails.send({
        from: "Australian Racing Tours <info@australianracingtours.com.au>",
        to: [r.email],
        subject: subjectLine,
        html,
      });
      if (!error) {
        sent++;
        // Log to email_logs so it appears in tracking
        try {
          await supabase.from("email_logs").insert({
            message_id: sendData?.id || `task-notif-${Date.now()}-${r.id}`,
            recipient_email: r.email,
            recipient_name: r.first_name || null,
            subject: subjectLine,
            template_name:
              body.type === "mention"
                ? "Task Mention"
                : body.type === "subtask_assignment"
                ? "Subtask Assignment"
                : "Task Assignment",
            sent_by: body.actorUserId,
          });
        } catch (logErr) {
          console.error("Failed to log task notification email:", logErr);
        }
      } else {
        console.error("Resend error for", r.email, error);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-task-notification error", error);
    return new Response(JSON.stringify({ error: error.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
