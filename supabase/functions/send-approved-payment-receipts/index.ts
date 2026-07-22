import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function mergeTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}
function formatMoney(n: number): string {
  return `${(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDateAU(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const receiptIds: string[] = Array.isArray(body?.receipt_ids) ? body.receipt_ids : [];
    const action: "approve" | "reject" = body?.action === "reject" ? "reject" : "approve";
    const rejectionReason: string | null = body?.rejection_reason || null;
    const approverId: string | null = body?.approver_id || null;

    if (receiptIds.length === 0) {
      return new Response(JSON.stringify({ error: "receipt_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REJECT path — no email, just mark rejected
    if (action === "reject") {
      const { error } = await supabase
        .from("xero_payment_receipts")
        .update({
          approval_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          approved_by: approverId,
        })
        .in("id", receiptIds)
        .eq("approval_status", "pending");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, rejected: receiptIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APPROVE path — fetch template, brand, customer, then send
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

    const { data: gs } = await supabase
      .from("general_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["default_sender_name", "default_from_email_client"]);
    const gsMap = new Map((gs ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const senderName = gsMap.get("default_sender_name") || "Australian Racing Tours";
    const defaultFrom = template.from_email
      || gsMap.get("default_from_email_client")
      || "bookings@australianracingtours.com.au";
    const fallbackFromField = `${senderName} <${defaultFrom}>`;

    const { data: defaultBrandRow } = await supabase
      .from("brands")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    const { data: receipts, error: rErr } = await supabase
      .from("xero_payment_receipts")
      .select(`
        id, booking_id, xero_invoice_number, amount, currency_code, payment_date,
        payment_reference, invoice_total, invoice_amount_paid, invoice_amount_due,
        recipient_email, approval_status,
        bookings:booking_id (
          id, tour_id,
          tours:tour_id (
            id, name, brand_id,
            brand:brand_id (
              id, name, sender_name, from_email_client, email_header_image_url,
              color_primary, color_border, color_button, color_button_text, color_accent,
              footer_text, company_website, company_phone
            )
          ),
          customers:lead_passenger_id ( id, first_name, last_name, email )
        )
      `)
      .in("id", receiptIds);
    if (rErr) throw rErr;

    let sent = 0;
    let errors = 0;

    for (const r of receipts ?? []) {
      if (r.approval_status !== "pending") continue;
      const b: any = (r as any).bookings;
      const tour = b?.tours;
      const cust = b?.customers;
      const recipient = r.recipient_email || cust?.email;
      if (!recipient) {
        await supabase.from("xero_payment_receipts").update({
          approval_status: "skipped",
          skipped_reason: "no_recipient_email",
        }).eq("id", r.id);
        continue;
      }

      const brand = tour?.brand || defaultBrandRow || null;
      const fromField = brand?.sender_name && brand?.from_email_client
        ? `${brand.sender_name} <${brand.from_email_client}>`
        : fallbackFromField;

      const currency = r.currency_code || "AUD";
      const vars: Record<string, string> = {
        lead_passenger_first_name: cust?.first_name || "",
        lead_passenger_last_name: cust?.last_name || "",
        lead_passenger_name: [cust?.first_name, cust?.last_name].filter(Boolean).join(" "),
        tour_name: tour?.name || "",
        payment_amount: formatMoney(Number(r.amount) || 0),
        payment_date: formatDateAU(r.payment_date),
        payment_reference: r.payment_reference || "",
        invoice_number: r.xero_invoice_number || "",
        invoice_total: formatMoney(Number(r.invoice_total) || 0),
        invoice_amount_paid: formatMoney(Number(r.invoice_amount_paid) || 0),
        invoice_amount_due: formatMoney(Number(r.invoice_amount_due) || 0),
        balance_remaining: formatMoney(Number(r.invoice_amount_due) || 0),
        currency,
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
        const result = await resend.emails.send({
          from: fromField,
          to: [recipient!],
          subject,
          html,
        });
        if ((result as any).error) throw new Error((result as any).error?.message || "resend error");
        const messageId = (result as any).data?.id || null;

        await supabase.from("xero_payment_receipts").update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: approverId,
          receipt_email_sent_at: new Date().toISOString(),
          receipt_email_id: messageId,
          send_error: null,
        }).eq("id", r.id);

        await supabase.from("email_logs").insert({
          message_id: messageId,
          booking_id: b?.id ?? null,
          tour_id: tour?.id ?? null,
          recipient_email: recipient,
          recipient_name: vars.lead_passenger_name,
          subject,
          template_name: template.name,
          template_id: template.id,
        });

        sent++;
        // Respect Resend 2/sec limit
        await new Promise((res) => setTimeout(res, 600));
      } catch (sendErr: any) {
        errors++;
        await supabase.from("xero_payment_receipts").update({
          send_error: String(sendErr?.message || sendErr).slice(0, 500),
        }).eq("id", r.id);
        console.error("Receipt send failed", { receiptId: r.id, err: sendErr });
      }
    }

    return new Response(JSON.stringify({ success: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-approved-payment-receipts error", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});