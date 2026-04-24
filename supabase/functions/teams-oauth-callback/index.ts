import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";

function decodeReturnUrl(value: string) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return APP_URL;
  }
}

function getFrontendUrlFromState(state: string) {
  const encoded = state.split(".").slice(1).join(".");
  if (!encoded) return APP_URL;

  const decoded = decodeReturnUrl(encoded);
  try {
    const url = new URL(decoded);
    return url.origin;
  } catch {
    return APP_URL;
  }
}

function redirectToFrontend(frontendUrl: string, message: string, success: boolean, displayName?: string | null) {
  const params = new URLSearchParams({
    success: success ? "1" : "0",
    message,
  });

  if (displayName) {
    params.set("displayName", displayName);
  }

  return Response.redirect(`${frontendUrl}/teams-oauth-complete?${params.toString()}`, 302);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    if (!code || !state) {
      return redirectToFrontend(APP_URL, "Missing authorization code or state parameter.", false);
    }

    const frontendUrl = getFrontendUrlFromState(state);

    if (errorParam) {
      return redirectToFrontend(frontendUrl, `Microsoft returned an error: ${errorDesc || errorParam}`, false);
    }

    const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
    const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
    const redirectUri = Deno.env.get("MS_GRAPH_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      return redirectToFrontend(frontendUrl, "Server is missing Microsoft Graph configuration.", false);
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
      return redirectToFrontend(frontendUrl, "Invalid or expired authorization state. Please try again.", false);
    }
    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from("teams_oauth_states").delete().eq("state", state);
      return redirectToFrontend(frontendUrl, "Authorization request expired. Please try again.", false);
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
      return redirectToFrontend(frontendUrl, `Token exchange failed: ${tokenData.error_description || tokenData.error || "unknown"}`, false);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;
    if (!access_token || !refresh_token) {
      return redirectToFrontend(frontendUrl, "Microsoft did not return both access and refresh tokens. Make sure 'offline_access' scope is granted.", false);
    }

    // Fetch the Microsoft user profile
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok || !meData.id) {
      console.error("Failed to fetch /me:", meData);
      return redirectToFrontend(frontendUrl, "Could not fetch your Microsoft profile.", false);
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
      return redirectToFrontend(frontendUrl, "Failed to save your Teams connection. Please try again.", false);
    }

    // Clean up state
    await supabase.from("teams_oauth_states").delete().eq("state", state);

    return redirectToFrontend(
      frontendUrl,
      `Connected as ${meData.displayName || meData.userPrincipalName}. You can close this window.`,
      true,
      meData.displayName || meData.userPrincipalName,
    );
  } catch (error: unknown) {
    console.error("teams-oauth-callback error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return redirectToFrontend(APP_URL, message, false);
  }
});