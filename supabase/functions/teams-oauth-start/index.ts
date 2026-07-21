import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "User.Read",
  "User.ReadBasic.All",
  "Chat.Create",
  "ChatMessage.Send",
].join(" ");

function encodeReturnUrl(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
    const redirectUri = Deno.env.get("MS_GRAPH_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      throw new Error("Microsoft Graph OAuth env vars not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestReturnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : "";
    const headerOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
    const fallbackOrigin = headerOrigin ? new URL(headerOrigin).origin : "https://art-tour-manager.lovable.app";
    const returnUrl = requestReturnUrl || fallbackOrigin;

    const state = `${generateState()}.${encodeReturnUrl(returnUrl)}`;
    const { error: stateErr } = await supabase
      .from("teams_oauth_states")
      .insert({ state, user_id: userData.user.id });
    if (stateErr) throw stateErr;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: SCOPES,
      state,
      prompt: "select_account",
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("teams-oauth-start error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});