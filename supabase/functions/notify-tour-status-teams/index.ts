import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://admin.australianracingtours.com.au";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

interface Payload {
  tour_id: string;
  tour_name: string;
  old_status: string | null;
  new_status: string;
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(s: string | null): string {
  if (!s) return "Unknown";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function refreshActorToken(
  supabase: ReturnType<typeof createClient>,
  actorUserId: string,
): Promise<{ accessToken: string; msUserId: string } | null> {
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
    return {
      accessToken: conn.access_token as string,
      msUserId: conn.ms_user_id as string,
    };
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

  return { accessToken: data.access_token, msUserId: conn.ms_user_id as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body.tour_id || !body.new_status) {
      return new Response(JSON.stringify({ error: "Missing tour_id or new_status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await supabase
      .from("teams_channel_notify_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (!cfg || !cfg.enabled || !cfg.team_id || !cfg.channel_id || !cfg.poster_user_id) {
      return new Response(JSON.stringify({ skipped: "not_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(cfg.notify_statuses || []).includes(body.new_status)) {
      return new Response(JSON.stringify({ skipped: "status_not_watched" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = await refreshActorToken(supabase, cfg.poster_user_id);
    if (!ctx) {
      console.error("Poster user has no Teams connection");
      return new Response(JSON.stringify({ error: "poster_not_connected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tourUrl = `${APP_URL}/tours/${body.tour_id}`;
    const newLabel = statusLabel(body.new_status);
    const oldLabel = statusLabel(body.old_status);
    const html = `
<p><strong>Tour status update</strong></p>
<p><a href="${tourUrl}"><strong>${escapeHtml(body.tour_name || "Tour")}</strong></a> is now <strong>${escapeHtml(newLabel)}</strong>${
      body.old_status ? ` (was ${escapeHtml(oldLabel)})` : ""
    }.</p>
<p>Please update the website accordingly.</p>
`.trim();

    const resp = await fetch(
      `${GRAPH_BASE}/teams/${encodeURIComponent(cfg.team_id)}/channels/${encodeURIComponent(
        cfg.channel_id,
      )}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: { contentType: "html", content: html } }),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Teams channel post failed [${resp.status}]:`, text);
      return new Response(
        JSON.stringify({ error: "channel_post_failed", status: resp.status, details: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await resp.text();
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("notify-tour-status-teams error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});