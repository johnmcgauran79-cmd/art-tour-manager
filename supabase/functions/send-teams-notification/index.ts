import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_teams";
const APP_URL = "https://art-tour-manager.lovable.app";

interface TeamsNotificationRequest {
  type: "mention" | "assignment";
  taskId: string;
  recipientUserIds: string[];
  actorUserId: string;
  message?: string;
}

async function teamsFetch(path: string, init: RequestInit = {}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TEAMS_API_KEY = Deno.env.get("MICROSOFT_TEAMS_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TEAMS_API_KEY) throw new Error("MICROSOFT_TEAMS_API_KEY is not configured");

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TEAMS_API_KEY,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
}

/**
 * Resolve a Teams user id for a given email by querying Microsoft Graph.
 * Returns null if the user can't be found in the same tenant.
 */
async function resolveTeamsUserId(email: string): Promise<string | null> {
  try {
    const res = await teamsFetch(`/users/${encodeURIComponent(email)}?$select=id`);
    if (!res.ok) {
      console.warn(`Could not resolve Teams user for ${email}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.id ?? null;
  } catch (err) {
    console.error(`resolveTeamsUserId error for ${email}:`, err);
    return null;
  }
}

/**
 * Get the "me" id for the connected service account, used as a chat member.
 */
async function getMeId(): Promise<string | null> {
  try {
    const res = await teamsFetch(`/me?$select=id`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Create or get a 1:1 chat with the recipient. */
async function createOrGetOneOnOneChat(
  meId: string,
  recipientTeamsId: string,
): Promise<string | null> {
  try {
    const body = {
      chatType: "oneOnOne",
      members: [
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${meId}')`,
        },
        {
          "@odata.type": "#microsoft.graph.aadUserConversationMember",
          roles: ["owner"],
          "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${recipientTeamsId}')`,
        },
      ],
    };
    const res = await teamsFetch(`/chats`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`createOrGetOneOnOneChat failed [${res.status}]:`, text);
      return null;
    }
    const data = await res.json();
    return data?.id ?? null;
  } catch (err) {
    console.error("createOrGetOneOnOneChat error:", err);
    return null;
  }
}

async function sendChatMessage(chatId: string, html: string): Promise<boolean> {
  try {
    const res = await teamsFetch(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: { contentType: "html", content: html },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`sendChatMessage failed [${res.status}]:`, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendChatMessage error:", err);
    return false;
  }
}

serve(async (req) => {
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

    // Resolve task
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

    // Actor name
    const { data: actor } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", body.actorUserId)
      .single();
    const actorName = actor
      ? `${actor.first_name || ""} ${actor.last_name || ""}`.trim() || actor.email
      : "Someone";

    // Recipients (dedupe). Actor is intentionally NOT excluded so users can self-test.
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

    const meId = await getMeId();
    if (!meId) {
      console.warn("Could not get Teams 'me' id — service account may not be configured.");
      return new Response(
        JSON.stringify({ success: false, sent: 0, fallback: recipientIds, reason: "no_me_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip @[Name](uuid) → @Name and HTML-escape the message
    const cleanedMessage = body.message
      ? body.message.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
      : "";
    const escapedMessage = cleanedMessage
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .substring(0, 1000);

    const taskUrl = `${APP_URL}/tasks/${task.id}`;
    const dueLine = task.due_date
      ? `<p>Due: <strong>${new Date(task.due_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}</strong></p>`
      : "";

    const verbHtml = body.type === "mention"
      ? `mentioned you in a comment on`
      : `assigned you to`;

    const messageBlock = escapedMessage
      ? `<blockquote>${escapedMessage}</blockquote>`
      : "";

    const sent: string[] = [];
    const fallback: string[] = [];

    for (const r of recipients || []) {
      // Resolve & cache teams_user_id
      let teamsUserId = r.teams_user_id;
      if (!teamsUserId && r.email) {
        teamsUserId = await resolveTeamsUserId(r.email);
        if (teamsUserId) {
          await supabase
            .from("profiles")
            .update({ teams_user_id: teamsUserId })
            .eq("id", r.id);
        }
      }

      if (!teamsUserId) {
        fallback.push(r.id);
        continue;
      }

      const chatId = await createOrGetOneOnOneChat(meId, teamsUserId);
      if (!chatId) {
        fallback.push(r.id);
        continue;
      }

      const html = `
<p>Hi ${r.first_name || "there"},</p>
<p><strong>${actorName}</strong> ${verbHtml} the task <strong>${task.title}</strong>.</p>
${dueLine}
${messageBlock}
<p><a href="${taskUrl}">Open task</a></p>
`.trim();

      const ok = await sendChatMessage(chatId, html);
      if (ok) sent.push(r.id);
      else fallback.push(r.id);
    }

    return new Response(
      JSON.stringify({ success: true, sent: sent.length, sentTo: sent, fallback }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("send-teams-notification error", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});