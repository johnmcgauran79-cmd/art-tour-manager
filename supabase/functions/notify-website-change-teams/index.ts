import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://admin.australianracingtours.com.au";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

interface Payload {
  tour_id: string;
  tour_name?: string;
  section: string;
  section_label?: string;
  request_id?: string;
  changed_by?: string | null;
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function refreshActorToken(
  supabase: ReturnType<typeof createClient>,
  actorUserId: string,
): Promise<{ accessToken: string } | null> {
  const { data: conn } = await supabase
    .from("user_teams_connections")
    .select("ms_user_id, refresh_token, access_token, access_token_expires_at")
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (!conn) return null;

  if (
    conn.access_token &&
    conn.access_token_expires_at &&
    new Date(conn.access_token_expires_at as string) > new Date(Date.now() + 60_000)
  ) {
    return { accessToken: conn.access_token as string };
  }

  const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("MS_GRAPH env vars missing");
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
      refresh_token: data.refresh_token || conn.refresh_token,
    })
    .eq("user_id", actorUserId);

  return { accessToken: data.access_token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = (await req.json()) as Payload;
    if (!body.tour_id || !body.section) return json({ error: "Missing tour_id or section" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await supabase
      .from("teams_channel_notify_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    const hasChat = !!cfg?.chat_id;
    const hasChannel = !!(cfg?.team_id && cfg?.channel_id);
    if (!cfg || !cfg.enabled || !cfg.poster_user_id || (!hasChat && !hasChannel)) {
      return json({ skipped: "not_configured" });
    }

    const ctx = await refreshActorToken(supabase, cfg.poster_user_id as string);
    if (!ctx) return json({ error: "poster_not_connected" });

    let changedByName = "";
    if (body.changed_by) {
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", body.changed_by)
        .maybeSingle();
      if (p) {
        changedByName =
          [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email as string) || "";
      }
    }

    const label = body.section_label || body.section;
    const approvalUrl = `${APP_URL}/communications?tab=website`;
    const html = `
<p><strong>Website change awaiting approval</strong></p>
<p>An <strong>${escapeHtml(label)}</strong> change has been sent for <strong>${escapeHtml(
      body.tour_name || "Tour",
    )}</strong>${changedByName ? ` by ${escapeHtml(changedByName)}` : ""}.</p>
<p><a href="${approvalUrl}">Open the approval queue</a></p>
`.trim();

    const endpoint = hasChat
      ? `${GRAPH_BASE}/chats/${encodeURIComponent(cfg.chat_id as string)}/messages`
      : `${GRAPH_BASE}/teams/${encodeURIComponent(cfg.team_id as string)}/channels/${encodeURIComponent(
          cfg.channel_id as string,
        )}/messages`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: { contentType: "html", content: html } }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Teams post failed [${resp.status}]:`, text);
      return json({ error: "post_failed", status: resp.status, details: text });
    }
    await resp.text();
    return json({ success: true });
  } catch (error: unknown) {
    console.error("notify-website-change-teams error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
