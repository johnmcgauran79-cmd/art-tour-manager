// Daily permanent purge of expired / long-soft-deleted ART AI conversations.
// Trusted process: invoked by pg_cron. Uses the SECURITY DEFINER purge RPC via
// the service-role client. No message content is read or logged.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc("purge_ai_conversations");
  if (error) {
    console.error("[purge-ai-conversations] error", error.message);
    return new Response(JSON.stringify({ error: "purge_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[purge-ai-conversations] purged ${data ?? 0} conversation(s)`);
  return new Response(JSON.stringify({ purged: data ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});