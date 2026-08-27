import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Cron worker (every 5 minutes): finds campaigns whose scheduled send time has
 * passed and drains their queued recipients through marketing-send-campaign.
 * Recipients are queued when the campaign is scheduled, so this only sends.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
      .from("marketing_campaigns")
      .select("id, name, status, scheduled_send_at")
      .in("status", ["scheduled", "sending"])
      .not("scheduled_send_at", "is", null)
      .lte("scheduled_send_at", nowIso)
      .order("scheduled_send_at")
      .limit(5);
    if (error) throw error;

    if (!due?.length) return json({ processed: 0, campaigns: [] });

    const results: { id: string; name: string; sent: number; remaining: number }[] = [];
    const deadline = Date.now() + 4 * 60 * 1000; // keep within the cron window

    for (const campaign of due) {
      // Nothing queued -> nothing this worker can send safely.
      const { count } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "queued");
      if (!count) {
        await supabase
          .from("marketing_campaigns")
          .update({ status: "sent", send_completed_at: nowIso })
          .eq("id", campaign.id)
          .eq("status", "sending");
        continue;
      }

      let sent = 0;
      let remaining = count;
      while (remaining > 0 && Date.now() < deadline) {
        const res = await fetch(`${supabaseUrl}/functions/v1/marketing-send-campaign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({ action: "process", campaignId: campaign.id, batchSize: 40 }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body?.error) {
          console.error("Campaign send batch failed:", campaign.id, body?.error || res.status);
          break;
        }
        sent += Number(body?.sent || 0);
        remaining = Number(body?.remaining ?? 0);
      }

      results.push({ id: campaign.id, name: campaign.name, sent, remaining });
    }

    return json({ processed: results.length, campaigns: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("process-scheduled-campaigns error:", msg);
    return json({ error: msg }, 500);
  }
});
