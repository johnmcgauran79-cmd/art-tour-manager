import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";

function htmlResponse(message: string, success: boolean) {
  const color = success ? "#16a34a" : "#dc2626";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Microsoft Teams ${success ? "Connected" : "Connection Failed"}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}
.card{background:#fff;padding:36px;border-radius:12px;max-width:480px;width:100%;box-shadow:0 8px 24px rgba(0,0,0,.08);text-align:center;}
h1{color:${color};margin:0 0 12px;font-size:22px;}p{color:#374151;line-height:1.5;margin:0 0 18px;}
a{display:inline-block;background:#1a2332;color:#f5c518;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;}</style></head>
<body><div class="card"><h1>${success ? "✓ Microsoft Teams Connected" : "Connection Failed"}</h1>
<p>${message}</p><a href="${APP_URL}">Return to app</a></div>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:"teams-oauth",success:${success}},"*");}catch(e){}},100);</script>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    if (errorParam) {
      return htmlResponse(`Microsoft returned an error: ${errorDesc || errorParam}`, false);
    }
    if (!code || !state) {
      return htmlResponse("Missing authorization code or state parameter.", false);
    }

    const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
    const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
    const redirectUri = Deno.env.get("MS_GRAPH_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      return htmlResponse("Server is missing Microsoft Graph configuration.", false);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate state
    const { data: stateRow, error: stateErr } = await supabase
      .from("teams_oauth_states")
      .select("user_id, expires_at")
      .eq("state", state)
      .maybeSingle();
    if (stateErr || !stateRow) {
      return htmlResponse("Invalid or expired authorization state. Please try again.", false);
    }
    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from("teams_oauth_states").delete().eq("state", state);
      return htmlResponse("Authorization request expired. Please try again.", false);
    }

    const userId = stateRow.user_id;

    // Exchange code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenData);
      return htmlResponse(`Token exchange failed: ${tokenData.error_description || tokenData.error || "unknown"}`, false);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;
    if (!access_token || !refresh_token) {
      return htmlResponse("Microsoft did not return both access and refresh tokens. Make sure 'offline_access' scope is granted.", false);
    }

    // Fetch the Microsoft user profile
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok || !meData.id) {
      console.error("Failed to fetch /me:", meData);
      return htmlResponse("Could not fetch your Microsoft profile.", false);
    }

    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();

    // Upsert the connection
    const { error: upsertErr } = await supabase
      .from("user_teams_connections")
      .upsert({
        user_id: userId,
        ms_user_id: meData.id,
        ms_display_name: meData.displayName,
        ms_user_principal_name: meData.userPrincipalName,
        refresh_token,
        access_token,
        access_token_expires_at: expiresAt,
        scope: scope || null,
        connected_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("Failed to store connection:", upsertErr);
      return htmlResponse("Failed to save your Teams connection. Please try again.", false);
    }

    // Clean up state
    await supabase.from("teams_oauth_states").delete().eq("state", state);

    return htmlResponse(`Connected as ${meData.displayName || meData.userPrincipalName}. You can close this window.`, true);
  } catch (error: unknown) {
    console.error("teams-oauth-callback error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return htmlResponse(message, false);
  }
});