/**
 * Post an HTML message to the configured Teams chat/channel using the
 * connected poster's delegated Graph token (same config as tour/website alerts).
 */
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function refreshActorToken(supabase: any, actorUserId: string) {
  const { data: conn } = await supabase
    .from("user_teams_connections")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (!conn) return null;

  if (
    conn.access_token &&
    conn.access_token_expires_at &&
    new Date(conn.access_token_expires_at) > new Date(Date.now() + 60_000)
  ) {
    return conn.access_token as string;
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
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access Chat.ReadWrite ChannelMessage.Send User.Read",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("Teams refresh token exchange failed:", JSON.stringify(data));
    return null;
  }

  await supabase
    .from("user_teams_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || conn.refresh_token,
      access_token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    })
    .eq("user_id", actorUserId);

  return data.access_token as string;
}

export async function postTeamsMessage(
  supabase: any,
  html: string
): Promise<{ success: boolean; reason?: string }> {
  const { data: cfg } = await supabase
    .from("teams_channel_notify_config")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  const hasChat = !!cfg?.chat_id;
  const hasChannel = !!(cfg?.team_id && cfg?.channel_id);
  if (!cfg || !cfg.enabled || !cfg.poster_user_id || (!hasChat && !hasChannel)) {
    return { success: false, reason: "not_configured" };
  }

  const token = await refreshActorToken(supabase, cfg.poster_user_id);
  if (!token) return { success: false, reason: "poster_not_connected" };

  const endpoint = hasChat
    ? `${GRAPH_BASE}/chats/${encodeURIComponent(cfg.chat_id)}/messages`
    : `${GRAPH_BASE}/teams/${encodeURIComponent(cfg.team_id)}/channels/${encodeURIComponent(
        cfg.channel_id
      )}/messages`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ body: { contentType: "html", content: html } }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Teams post failed [${resp.status}]: ${text}`);
    return { success: false, reason: `post_failed_${resp.status}` };
  }
  await resp.text();
  return { success: true };
}

export const escapeHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
