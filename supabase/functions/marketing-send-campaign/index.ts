import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const APP_URL = Deno.env.get("PUBLIC_APP_URL") || "https://art-tour-manager.lovable.app";

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ensure a preference-centre row exists and return its token. */
const getPreferenceToken = async (
  supabase: ReturnType<typeof admin>,
  email: string,
  customerId?: string | null
): Promise<string> => {
  const key = email.trim().toLowerCase();
  const { data: existing } = await supabase
    .from("marketing_preferences")
    .select("token")
    .eq("email", key)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const { data: created, error } = await supabase
    .from("marketing_preferences")
    .insert({ email: key, customer_id: customerId || null })
    .select("token")
    .maybeSingle();
  if (error) {
    // Race: another send created it first.
    const { data: retry } = await supabase
      .from("marketing_preferences")
      .select("token")
      .eq("email", key)
      .maybeSingle();
    if (retry?.token) return retry.token;
    throw error;
  }
  return created!.token as string;
};

const personalise = (
  html: string,
  vars: Record<string, string>
): string =>
  html.replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi, (_m, key: string) =>
    vars[key.toLowerCase()] ?? ""
  );

serve_handler();

function serve_handler() {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const supabase = admin();
      const body = await req.json().catch(() => ({}));
      const action = body?.action as string;
      const campaignId = body?.campaignId as string;

      // Ad-hoc template test: no campaign needed, html + subject supplied directly.
      const adHocHtml = typeof body?.html === "string" ? body.html : "";
      const isAdHocTest = action === "test" && !campaignId && !!adHocHtml;

      if (!action) return json({ error: "action required" }, 400);
      if (!campaignId && !isAdHocTest)
        return json({ error: "action and campaignId required" }, 400);

      let campaign: any = null;
      if (campaignId) {
        const { data, error: cErr } = await supabase
          .from("marketing_campaigns")
          .select("*, brand:brands(*)")
          .eq("id", campaignId)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!data) return json({ error: "Campaign not found" }, 404);
        campaign = data;
      } else {
        let adHocBrand: any = null;
        if (body?.brandId) {
          const { data } = await supabase
            .from("brands")
            .select("*")
            .eq("id", body.brandId)
            .maybeSingle();
          adHocBrand = data;
        }
        campaign = {
          subject: String(body?.subject || "Template test"),
          html_body: adHocHtml,
          reply_to: null,
          from_name: null,
          from_email: null,
          brand: adHocBrand,
        };
      }

      const brand = (campaign as any).brand || {};
      const fromName =
        (campaign.from_name || "").trim() ||
        (Deno.env.get("MARKETING_FROM_NAME") || "").trim() ||
        (brand.sender_name || "").trim() ||
        "Australian Racing Tours";
      const fromEmail =
        campaign.from_email ||
        Deno.env.get("MARKETING_FROM_EMAIL") ||
        brand.from_email_client ||
        "info@australianracingtours.com.au";
      // Quote the display name so inboxes always render it (never the mailbox name)
      const from = `"${fromName.replace(/"/g, "")}" <${fromEmail}>`;
      // Replies must land in a real, monitored mailbox — the sending subdomain
      // has no inbox, so always fall back to bookings@.
      const replyTo =
        (campaign.reply_to || "").trim() ||
        (Deno.env.get("MARKETING_REPLY_TO") || "").trim() ||
        (brand.from_email_client || "").trim() ||
        "bookings@australianracingtours.com.au";


      const html = campaign.html_body || "";
      if (!html) return json({ error: "Campaign has no content to send" }, 400);

      /* ------------------------------ test send ------------------------------ */
      if (action === "test") {
        const testEmail = String(body?.testEmail || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail))
          return json({ error: "Valid testEmail required" }, 400);

        const token = await getPreferenceToken(supabase, testEmail);
        const rendered = personalise(html, {
          first_name: "there",
          last_name: "",
          full_name: "there",
          email: testEmail,
          preferences_url: `${APP_URL}/email-preferences/${token}`,
          unsubscribe_url: `${APP_URL}/email-preferences/${token}?unsubscribe=1`,
          view_in_browser_url: `${APP_URL}/email-preferences/${token}`,
        });

        const sent = await resend.emails.send({
          from,
          to: [testEmail],
          subject: `[TEST] ${campaign.subject}`,
          html: rendered,
          reply_to: replyTo,
        });
        if ((sent as any)?.error) return json({ error: (sent as any).error.message }, 502);
        return json({ ok: true });
      }

      /* -------------------------------- prepare ------------------------------ */
      if (action === "prepare") {
        const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
        if (!recipients.length) return json({ error: "recipients required" }, 400);

        // Drop suppressed addresses (bounces, complaints, manual blocks).
        const emails = recipients
          .map((r: any) => String(r.email || "").trim().toLowerCase())
          .filter(Boolean);
        const { data: suppressed } = await supabase
          .from("email_suppressions")
          .select("email_address")
          .in("email_address", emails);
        const blocked = new Set((suppressed || []).map((s: any) => s.email_address));

        const { data: unsub } = await supabase
          .from("marketing_preferences")
          .select("email")
          .eq("subscribed", false)
          .in("email", emails);
        (unsub || []).forEach((u: any) => blocked.add(u.email));

        const rows = recipients
          .map((r: any) => ({
            campaign_id: campaignId,
            customer_id: r.customer_id || null,
            email: String(r.email || "").trim().toLowerCase(),
            first_name: r.first_name || null,
            last_name: r.last_name || null,
            status: "queued",
          }))
          .filter((r: any) => r.email && !blocked.has(r.email));

        if (rows.length) {
          const { error } = await supabase
            .from("campaign_recipients")
            .upsert(rows, { onConflict: "campaign_id,email", ignoreDuplicates: true });
          if (error) throw error;
        }

        const { count } = await supabase
          .from("campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId);

        await supabase
          .from("marketing_campaigns")
          .update({
            status: "sending",
            total_recipients: count || 0,
            send_started_at: campaign.send_started_at || new Date().toISOString(),
          })
          .eq("id", campaignId);

        return json({ queued: rows.length, skipped: recipients.length - rows.length, total: count || 0 });
      }

      /* -------------------------------- process ------------------------------ */
      if (action === "process") {
        const batchSize = Math.min(Number(body?.batchSize) || 40, 100);
        const { data: batch, error: bErr } = await supabase
          .from("campaign_recipients")
          .select("id, email, first_name, last_name, customer_id")
          .eq("campaign_id", campaignId)
          .eq("status", "queued")
          .limit(batchSize);
        if (bErr) throw bErr;

        let sent = 0;
        let failed = 0;

        for (const r of batch || []) {
          try {
            const token = await getPreferenceToken(supabase, r.email, r.customer_id);
            const rendered = personalise(html, {
              first_name: r.first_name || "there",
              last_name: r.last_name || "",
              full_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "there",
              email: r.email,
              preferences_url: `${APP_URL}/email-preferences/${token}`,
              unsubscribe_url: `${APP_URL}/email-preferences/${token}?unsubscribe=1`,
              view_in_browser_url: `${APP_URL}/email-preferences/${token}`,
            });

            const result = await resend.emails.send({
              from,
              to: [r.email],
              subject: personalise(campaign.subject || "", {
                first_name: r.first_name || "",
                last_name: r.last_name || "",
              }),
              html: rendered,
              reply_to: replyTo,
              headers: {
                "List-Unsubscribe": `<${APP_URL}/email-preferences/${token}?unsubscribe=1>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            });

            if ((result as any)?.error) throw new Error((result as any).error.message);

            await supabase
              .from("campaign_recipients")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                provider_message_id: (result as any)?.data?.id || null,
                error_message: null,
              })
              .eq("id", r.id);
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Campaign ${campaignId} failed for ${r.email}: ${msg}`);
            await supabase
              .from("campaign_recipients")
              .update({ status: "failed", error_message: msg })
              .eq("id", r.id);
            failed++;
          }
          // Resend allows ~2 requests/second.
          await sleep(600);
        }

        const [{ count: remaining }, { count: sentTotal }, { count: failedTotal }, { count: total }] =
          await Promise.all([
            supabase
              .from("campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("status", "queued"),
            supabase
              .from("campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("status", "sent"),
            supabase
              .from("campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("status", "failed"),
            supabase
              .from("campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId),
          ]);

        await supabase
          .from("marketing_campaigns")
          .update({
            sent_count: sentTotal || 0,
            failed_count: failedTotal || 0,
            total_recipients: total || 0,
            ...(remaining === 0
              ? { status: "sent", send_completed_at: new Date().toISOString() }
              : {}),
          })
          .eq("id", campaignId);

        return json({ sent, failed, remaining: remaining || 0, total: total || 0 });
      }

      return json({ error: `Unknown action: ${action}` }, 400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("marketing-send-campaign error:", msg);
      return json({ error: msg }, 500);
    }
  });
}
