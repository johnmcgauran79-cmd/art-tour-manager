import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

interface TeamsNotificationRequest {
  type: "mention" | "assignment";
  taskId: string;
  recipientUserIds: string[];
  actorUserId: string;
  message?: string;
}

interface ProfileRecipient {
  id: string;
  first_name: string | null;
  email: string | null;
}

interface ActorTokenContext {
  accessToken: string;
  msUserId: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function refreshActorToken(
  supabase: ReturnType<typeof createClient>,
  actorUserId: string,
): Promise<ActorTokenContext | null> {
  const { data: conn } = await supabase
    .from("user_teams_connections")
    .select("ms_user_id, refresh_token, access_token, access_token_expires_at")
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (!conn) return null;

  // Reuse cached token if still valid (60s safety margin)
  if (
    conn.access_token &&
    conn.access_token_expires_at &&
    new Date(conn.access_token_expires_at as string) > new Date(Date.now() + 60_000)
  ) {
    return {
      accessToken: conn.access_token as string,
      msUserId: conn.ms_user_id as string,
    };
  }

  const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("MS_GRAPH_CLIENT_ID or MS_GRAPH_CLIENT_SECRET missing");
    return null;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("Refresh token exchange failed:", data);
    return null;
  }

  const expiresAt = new Date(Date.now() + ((data.expires_in || 3600) - 60) * 1000).toISOString();
  await supabase
    .from("user_teams_connections")
    .update({
      access_token: data.access_token,
      access_token_expires_at: expiresAt,
      // Microsoft may rotate refresh tokens
      refresh_token: data.refresh_token || conn.refresh_token,
    })
    .eq("user_id", actorUserId);

  return { accessToken: data.access_token, msUserId: conn.ms_user_id as string };
}

async function graphFetch(accessToken: string, path: string, init: RequestInit = {}) {
  return await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function lookupRecipientMsUserId(
  accessToken: string,
  email: string,
): Promise<string | null> {
  // Try direct lookup first (works if email matches UPN)
  const direct = await graphFetch(
    accessToken,
    `/users/${encodeURIComponent(email)}?$select=id`,
  );
  if (direct.ok) {
    const data = await direct.json();
    if (data?.id) return data.id;
  } else if (direct.status !== 404 && direct.status !== 403) {
    const text = await direct.text();
    console.error(`Direct user lookup failed for ${email} [${direct.status}]:`, text);
  } else {
    await direct.text();
  }

  // Fallback: filter by mail or userPrincipalName (handles aliases / guest accounts)
  const filter = `mail eq '${email.replace(/'/g, "''")}' or userPrincipalName eq '${email.replace(/'/g, "''")}'`;
  const res = await graphFetch(
    accessToken,
    `/users?$filter=${encodeURIComponent(filter)}&$select=id&$top=1`,
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(`Filter user lookup failed for ${email} [${res.status}]:`, text);
    return null;
  }
  const data = await res.json();
  return data?.value?.[0]?.id ?? null;
}

async function createOrGetOneOnOneChat(
  accessToken: string,
  actorMsUserId: string,
  recipientMsUserId: string,
): Promise<string | null> {
  const response = await graphFetch(accessToken, "/chats", {
    method: "POST",
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${actorMsUserId}')`,
        },
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientMsUserId}')`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`createOrGetOneOnOneChat failed [${response.status}]:`, text);
    return null;
  }

  const data = await response.json();
  return data?.id ?? null;
}

async function sendChatMessage(
  accessToken: string,
  chatId: string,
  html: string,
): Promise<boolean> {
  const response = await graphFetch(
    accessToken,
    `/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body: { contentType: "html", content: html },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`sendChatMessage failed [${response.status}]:`, text);
    return false;
  }

  await response.text();
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as TeamsNotificationRequest;
    if (!body.type || !body.taskId || !body.recipientUserIds?.length || !body.actorUserId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date")
      .eq("id", body.taskId)
      .single();

    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actor } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", body.actorUserId)
      .single();

    const actorName = actor
      ? `${actor.first_name || ""} ${actor.last_name || ""}`.trim() || actor.email
      : "Someone";

    const recipientIds = Array.from(new Set(body.recipientUserIds));
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, fallback: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipients } = await supabase
      .from("profiles")
      .select("id, first_name, email")
      .in("id", recipientIds);

    // Per-user OAuth: resolve the actor's Teams token. If they haven't connected,
    // fall everything back to email so send-task-notification can email instead.
    const actorContext = await refreshActorToken(supabase, body.actorUserId);
    if (!actorContext) {
      console.log(
        `Actor ${body.actorUserId} has no Teams connection — falling back to email for all recipients`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          sentTo: [],
          fallback: recipientIds,
          reason: "actor_not_connected",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanedMessage = body.message
      ? body.message.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
      : "";
    const escapedMessage = cleanedMessage ? escapeHtml(cleanedMessage).substring(0, 1000) : "";

    const taskUrl = `${APP_URL}/tasks/${task.id}`;
    const dueLine = task.due_date
      ? `<p>Due: <strong>${new Date(task.due_date).toLocaleDateString("en-AU", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}</strong></p>`
      : "";

    const verbHtml = body.type === "mention"
      ? "mentioned you in a comment on"
      : "assigned you to";

    const messageBlock = escapedMessage ? `<blockquote>${escapedMessage}</blockquote>` : "";

    const sent: string[] = [];
    const fallback: string[] = [];

    for (const recipient of (recipients || []) as ProfileRecipient[]) {
      const html = `
<p>Hi ${escapeHtml(recipient.first_name || "there")},</p>
<p><strong>${escapeHtml(actorName)}</strong> ${verbHtml} the task <strong>${escapeHtml(task.title)}</strong>.</p>
${dueLine}
${messageBlock}
<p><a href="${taskUrl}">Open task</a></p>
`.trim();

      // Need the recipient's email/UPN to look them up in Microsoft Entra
      if (!recipient.email) {
        fallback.push(recipient.id);
        continue;
      }

      const recipientMsUserId = await lookupRecipientMsUserId(
        actorContext.accessToken,
        recipient.email,
      );
      if (!recipientMsUserId) {
        fallback.push(recipient.id);
        continue;
      }

      const chatId = await createOrGetOneOnOneChat(
        actorContext.accessToken,
        actorContext.msUserId,
        recipientMsUserId,
      );
      if (!chatId) {
        fallback.push(recipient.id);
        continue;
      }

      const delivered = await sendChatMessage(actorContext.accessToken, chatId, html);
      if (delivered) {
        sent.push(recipient.id);
      } else {
        fallback.push(recipient.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sent.length, sentTo: sent, fallback }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("send-teams-notification error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
