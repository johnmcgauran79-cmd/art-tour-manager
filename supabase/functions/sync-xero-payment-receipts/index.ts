import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// -----------------------------------------------------------------------------
// Xero auth (mirrors xero-webhook.getValidAccessToken)
// -----------------------------------------------------------------------------
async function getXeroAuth(supabase: any): Promise<{ token: string; tenantId: string } | null> {
  const { data: settings } = await supabase
    .from("xero_integration_settings")
    .select("*")
    .eq("is_connected", true)
    .maybeSingle();
  if (!settings) return null;

  const expiresAt = new Date(settings.token_expires_at).getTime();
  if (Date.now() >= expiresAt - 300_000) {
    const clientId = Deno.env.get("XERO_CLIENT_ID");
    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
    const r = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: settings.refresh_token }),
    });
    if (!r.ok) return null;
    const t = await r.json();
    await supabase.from("xero_integration_settings").update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", settings.id);
    return { token: t.access_token, tenantId: settings.tenant_id };
  }
  return { token: settings.access_token, tenantId: settings.tenant_id };
}

function parseXeroDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/\/Date\((-?\d+)/);
  if (m) return new Date(Number(m[1])).toISOString().split("T")[0];
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

async function fetchInvoice(auth: { token: string; tenantId: string }, invoiceId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Xero-Tenant-Id": auth.tenantId,
        Accept: "application/json",
      },
    });
    if (r.status === 429) {
      const wait = Math.max(parseInt(r.headers.get("Retry-After") || "5", 10) * 1000, 2000) * (attempt + 1);
      await r.text();
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    if (!r.ok) return null;
    const body = await r.json();
    return body.Invoices?.[0] ?? null;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Template merge (simple mustache-style)
// -----------------------------------------------------------------------------
function mergeTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function formatMoney(n: number, currency = "AUD"): string {
  return `${(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDateAU(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const historicalWindowDays = 7;
    const limit = Math.max(1, Math.min(Number(body?.limit) || 50, 100));
    const offset = Math.max(0, Number(body?.offset) || 0);

    const auth = await getXeroAuth(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Xero not connected" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("type", "payment_receipt")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ error: "No active payment_receipt email template configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch default from-address from key/value general_settings
    const { data: gs } = await supabase
      .from("general_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["default_sender_name", "default_from_email_client"]);
    const gsMap = new Map((gs ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const senderName = gsMap.get("default_sender_name") || "Australian Racing Tours";
    const defaultFrom = template.from_email
      || gsMap.get("default_from_email_client")
      || "bookings@australianracingtours.com.au";
    const fromField = `${senderName} <${defaultFrom}>`;

    // Fetch default brand for fallback theming
    const { data: defaultBrandRow } = await supabase
      .from("brands")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    // Count total for pagination reporting
    const { count: totalMappings } = await supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id", { count: "exact", head: true });

    // Pull a page of active mappings with booking + tour + brand + customer
    const { data: mappings, error: mErr } = await supabase
      .from("xero_invoice_mappings")
      .select(`
        xero_invoice_id, xero_invoice_number, booking_id,
        bookings:booking_id (
          id, tour_id, status, lead_passenger_id,
          tours:tour_id (
            id, name, payment_receipts_enabled, brand_id,
            brand:brand_id (
              id, name, sender_name, from_email_client, email_header_image_url,
              color_primary, color_border, color_button, color_button_text, color_accent,
              footer_text, company_website, company_phone
            )
          ),
          customers:lead_passenger_id ( id, first_name, last_name, email )
        )
      `)
      .order("xero_invoice_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (mErr) throw mErr;

    const stats = {
      invoices_checked: 0,
      new_payments: 0,
      receipts_sent: 0,
      skipped_historical: 0,
      skipped_opt_out: 0,
      skipped_no_email: 0,
      errors: 0,
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historicalWindowDays);

    for (const m of mappings ?? []) {
      if (!m.xero_invoice_id || !m.booking_id) continue;
      const b: any = m.bookings;
      if (!b) continue;
      if (b.status === "cancelled") continue;

      stats.invoices_checked++;

      const invoice = await fetchInvoice(auth, m.xero_invoice_id);
      // Throttle Xero calls (300ms) to respect rate limits
      await new Promise((r) => setTimeout(r, 300));
      if (!invoice) continue;

      const payments = Array.isArray(invoice.Payments) ? invoice.Payments : [];
      if (payments.length === 0) continue;

      // Existing payment IDs already recorded
      const { data: existing } = await supabase
        .from("xero_payment_receipts")
        .select("xero_payment_id")
        .in("xero_payment_id", payments.map((p: any) => p.PaymentID).filter(Boolean));
      const known = new Set((existing ?? []).map((r: any) => r.xero_payment_id));

      for (const p of payments) {
        const paymentId = p.PaymentID;
        if (!paymentId || known.has(paymentId)) continue;

        stats.new_payments++;

        const paymentDate = parseXeroDate(p.Date);
        const amount = Number(p.Amount) || 0;
        const currency = invoice.CurrencyCode || "AUD";
        const invoiceTotal = Number(invoice.Total) || 0;
        const invoicePaid = Number(invoice.AmountPaid) || 0;
        const invoiceDue = Number(invoice.AmountDue) || 0;

        const tour = b.tours;
        const cust = b.customers;
        const recipient = cust?.email || null;

        // Decide send vs skip
        let skippedReason: string | null = null;
        if (!tour?.payment_receipts_enabled) skippedReason = "tour_opt_out";
        else if (!recipient) skippedReason = "no_recipient_email";
        else if (paymentDate && new Date(paymentDate) < cutoff) skippedReason = "historical_backfill";

        // Insert receipt row (pending state) or with skip reason
        const insertRow = {
          booking_id: b.id,
          xero_invoice_id: m.xero_invoice_id,
          xero_invoice_number: m.xero_invoice_number,
          xero_payment_id: paymentId,
          amount,
          currency_code: currency,
          payment_date: paymentDate,
          payment_reference: p.Reference || null,
          invoice_total: invoiceTotal,
          invoice_amount_paid: invoicePaid,
          invoice_amount_due: invoiceDue,
          recipient_email: recipient,
          skipped_reason: skippedReason,
        };

        if (dryRun) {
          if (skippedReason === "historical_backfill") stats.skipped_historical++;
          else if (skippedReason === "tour_opt_out") stats.skipped_opt_out++;
          else if (skippedReason === "no_recipient_email") stats.skipped_no_email++;
          continue;
        }

        const { data: inserted, error: insErr } = await supabase
          .from("xero_payment_receipts")
          .insert(insertRow)
          .select()
          .maybeSingle();

        if (insErr) {
          // Likely a duplicate race — skip silently
          if (!String(insErr.message || "").includes("duplicate")) stats.errors++;
          continue;
        }

        if (skippedReason === "historical_backfill") { stats.skipped_historical++; continue; }
        if (skippedReason === "tour_opt_out") { stats.skipped_opt_out++; continue; }
        if (skippedReason === "no_recipient_email") { stats.skipped_no_email++; continue; }

        // Resolve brand (tour brand or default)
        const brand = (tour as any)?.brand || defaultBrandRow || null;
        const brandFromField = brand?.sender_name && brand?.from_email_client
          ? `${brand.sender_name} <${brand.from_email_client}>`
          : fromField;

        // Render + send
        const vars: Record<string, string> = {
          lead_passenger_first_name: cust?.first_name || "",
          lead_passenger_last_name: cust?.last_name || "",
          lead_passenger_name: [cust?.first_name, cust?.last_name].filter(Boolean).join(" "),
          tour_name: tour?.name || "",
          payment_amount: formatMoney(amount, currency),
          payment_date: formatDateAU(paymentDate),
          payment_reference: p.Reference || "",
          invoice_number: m.xero_invoice_number || "",
          invoice_total: formatMoney(invoiceTotal, currency),
          invoice_amount_paid: formatMoney(invoicePaid, currency),
          invoice_amount_due: formatMoney(invoiceDue, currency),
          balance_remaining: formatMoney(invoiceDue, currency),
          currency,
          // Brand / theme merge fields
          brand_name: brand?.name || "Australian Racing Tours",
          brand_sender_name: brand?.sender_name || senderName,
          brand_header_image_url: brand?.email_header_image_url || "",
          brand_color_primary: brand?.color_primary || "#0a1929",
          brand_color_border: brand?.color_border || "#0a1929",
          brand_color_button: brand?.color_button || "#0a1929",
          brand_color_button_text: brand?.color_button_text || "#d4a017",
          brand_color_accent: brand?.color_accent || "#d4a017",
          brand_footer_text: brand?.footer_text || "",
          brand_website: brand?.company_website || "",
          brand_phone: brand?.company_phone || "",
        };

        const subject = mergeTemplate(template.subject_template || "Payment received", vars);
        const html = mergeTemplate(template.content_template || "", vars);

        try {
          const sent = await resend.emails.send({
            from: brandFromField,
            to: [recipient!],
            subject,
            html,
          });

          if ((sent as any).error) throw new Error((sent as any).error?.message || "resend error");

          const messageId = (sent as any).data?.id || null;

          await supabase.from("xero_payment_receipts").update({
            receipt_email_sent_at: new Date().toISOString(),
            receipt_email_id: messageId,
          }).eq("id", inserted!.id);

          await supabase.from("email_logs").insert({
            message_id: messageId,
            booking_id: b.id,
            tour_id: tour?.id ?? null,
            recipient_email: recipient,
            recipient_name: vars.lead_passenger_name,
            subject,
            template_name: template.name,
            template_id: template.id,
          });

          stats.receipts_sent++;
          // 600ms pause between sends to respect Resend 2/sec limit
          await new Promise((r) => setTimeout(r, 600));
        } catch (sendErr: any) {
          stats.errors++;
          await supabase.from("xero_payment_receipts").update({
            send_error: String(sendErr?.message || sendErr).slice(0, 500),
          }).eq("id", inserted!.id);
          console.error("Receipt send failed", { paymentId, err: sendErr });
        }
      }
    }

    const nextOffset = offset + (mappings?.length || 0);
    const hasMore = nextOffset < (totalMappings || 0);
    return new Response(JSON.stringify({
      success: true,
      offset,
      limit,
      processed: mappings?.length || 0,
      total: totalMappings || 0,
      next_offset: nextOffset,
      has_more: hasMore,
      ...stats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-xero-payment-receipts error", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});