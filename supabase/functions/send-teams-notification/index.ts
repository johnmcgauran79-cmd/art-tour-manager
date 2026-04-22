import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";
const GATEWAY_BASE = "https://connector-gateway.lovable.dev/microsoft_teams";

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
  teams_user_id: string | null;
}

interface TeamsMeResponse {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
}

function getGatewayHeaders() {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const teamsApiKey = Deno.env.get("MICROSOFT_TEAMS_API_KEY");

  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  if (!teamsApiKey) {
    throw new Error("MICROSOFT_TEAMS_API_KEY is not configured");
  }

  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": teamsApiKey,
    "Content-Type": "application/json",
  };
}

async function gatewayFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      ...getGatewayHeaders(),
      ...(init.headers || {}),
    },
  });

  return response;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getCurrentTeamsUser(): Promise<TeamsMeResponse> {
  const response = await gatewayFetch("/me?$select=id,displayName,userPrincipalName");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to resolve Teams connection user [${response.status}]: ${text}`);
  }

  return await response.json();
}

async function createOrGetOneOnOneChat(recipientIdentifier: string, currentTeamsUserId: string): Promise<string | null> {
  const response = await gatewayFetch("/chats", {
    method: "POST",
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${currentTeamsUserId}')`,
        },
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientIdentifier}')`,
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

async function sendChatMessage(chatId: string, html: string): Promise<boolean> {
  const response = await gatewayFetch(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body: {
        contentType: "html",
        content: html,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`sendChatMessage failed [${response.status}]:`, text);
    return false;
  }

  await response.text();
  return true;
}

async function sendSelfChatMessage(html: string): Promise<boolean> {
  const response = await gatewayFetch("/me/chats/48:notes/messages", {
    method: "POST",
    body: JSON.stringify({
      body: {
        contentType: "html",
        content: html,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`sendSelfChatMessage failed [${response.status}]:`, text);
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
      .select("id, first_name, email, teams_user_id")
      .in("id", recipientIds);

    const currentTeamsUser = await getCurrentTeamsUser();
    const currentTeamsUserId = currentTeamsUser.id;
    const currentTeamsEmail = currentTeamsUser.userPrincipalName?.toLowerCase() || "";

    const cleanedMessage = body.message
      ? body.message.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
      : "";
    const escapedMessage = cleanedMessage ? escapeHtml(cleanedMessage).substring(0, 1000) : "";

    const taskUrl = `${APP_URL}/tasks/${task.id}`;
    const dueLine = task.due_date
      ? `<p>Due: <strong>${new Date(task.due_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}</strong></p>`
      : "";

    const verbHtml = body.type === "mention"
      ? "mentioned you in a comment on"
      : "assigned you to";

    const messageBlock = escapedMessage
      ? `<blockquote>${escapedMessage}</blockquote>`
      : "";

    const sent: string[] = [];
    const fallback: string[] = [];

    for (const recipient of (recipients || []) as ProfileRecipient[]) {
      const recipientEmail = recipient.email?.toLowerCase() || "";
      const isSelfChat = !!currentTeamsUserId && (
        recipient.teams_user_id === currentTeamsUserId ||
        (!!recipientEmail && recipientEmail === currentTeamsEmail)
      );

      const html = `
<p>Hi ${escapeHtml(recipient.first_name || "there")},</p>
<p><strong>${escapeHtml(actorName)}</strong> ${verbHtml} the task <strong>${escapeHtml(task.title)}</strong>.</p>
${dueLine}
${messageBlock}
<p><a href="${taskUrl}">Open task</a></p>
`.trim();

      let delivered = false;

      if (isSelfChat) {
        delivered = await sendSelfChatMessage(html);
      } else {
        const recipientIdentifier = recipient.teams_user_id || recipient.email;
        if (!recipientIdentifier) {
          fallback.push(recipient.id);
          continue;
        }

        const chatId = await createOrGetOneOnOneChat(recipientIdentifier, currentTeamsUserId);
        if (!chatId) {
          fallback.push(recipient.id);
          continue;
        }

        delivered = await sendChatMessage(chatId, html);
      }

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
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
