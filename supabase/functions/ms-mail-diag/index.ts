import { getAppToken, graphFetch } from "../_shared/msGraphApp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const out: Record<string, unknown> = {};
  try {
    const token = await getAppToken();
    out.token = `ok (${token.length} chars)`;
  } catch (e) {
    out.token = `failed: ${(e as Error).message}`;
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const address = new URL(req.url).searchParams.get("address") ??
    "bookings@australianracingtours.com.au";
  try {
    const res = await graphFetch(
      `/users/${encodeURIComponent(address)}/mailFolders/inbox/messages?$select=id,subject&$top=1`,
    );
    out.status = res.status;
    out.body = (await res.text()).slice(0, 800);
  } catch (e) {
    out.readError = (e as Error).message;
  }

  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
