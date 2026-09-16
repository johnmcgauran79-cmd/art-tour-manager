import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "$", NZD: "$", USD: "$", CAD: "$", SGD: "$", HKD: "$",
  GBP: "£", EUR: "€", JPY: "¥", CNY: "¥", CHF: "CHF ", ZAR: "R",
  AED: "AED ", THB: "฿", INR: "₹",
};
function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[(code || "AUD").toUpperCase()] ?? "";
}
function formatDateAU(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.reminder_ids) ? body.reminder_ids : [];
    const action: string = body?.action || "send";
    const reason: string | null = body?.reason || null;
    const actorId: string | null = body?.actor_id || null;
    const overrideRecipient: string | null =
      typeof body?.override_recipient_email === "string" && body.override_recipient_email.includes("@")
        ? body.override_recipient_email.trim()
        : null;

    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "reminder_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stop / skip paths — no email.
    if (action === "stop" || action === "skip") {
      const update = action === "stop"
        ? { state: "stopped", stop_reason: reason, actioned_by: actorId, actioned_at: new Date().toISOString() }
        : { next_due_at: addDays(7), actioned_by: actorId, actioned_at: new Date().toISOString() };
      const { error } = await supabase.from("instalment_reminders").update(update).in("id", ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action, count: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resume") {
      const { error } = await supabase.from("instalment_reminders")
        .update({ state: "pending", stop_reason: null, next_due_at: new Date().toISOString().split("T")[0] })
        .in("id", ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action, count: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEND path
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("type", "instalment_reminder")
      .eq("is_active", true)
      .maybeSingle();
    if (!template) {
      return new Response(
        JSON.stringify({ error: "No active instalment_reminder email template configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: gs } = await supabase
      .from("general_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["default_sender_name", "default_from_email_client", "bank_details_html"]);
    const gsMap = new Map((gs ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const clean = (v: unknown) => String(v ?? "").replace(/^"+|"+$/g, "").trim();
    const senderName = clean(gsMap.get("default_sender_name")) || "Australian Racing Tours";
    const defaultFrom = clean(template.from_email)
      || clean(gsMap.get("default_from_email_client"))
      || "bookings@australianracingtours.com.au";
    const fallbackFromField = `${senderName} <${defaultFrom}>`;
    const bankDetails = clean(gsMap.get("bank_details_html"));

    const { data: defaultBrandRow } = await supabase
      .from("brands").select("*").eq("is_default", true).eq("is_active", true).maybeSingle();

    const { data: reminders, error: rErr } = await supabase
      .from("instalment_reminders")
      .select("*")
      .in("id", ids);
    if (rErr) throw rErr;

    let sent = 0;
    let errors = 0;

    for (const r of reminders ?? []) {
      if (r.state === "stopped" || r.state === "resolved") continue;

      const { data: tour } = await supabase
        .from("tours")
        .select(`
          id, name, start_date, end_date, final_payment_date, brand_id,
          brand:brand_id (
            id, name, sender_name, from_email_client, email_header_image_url,
            color_primary, color_border, color_button, color_button_text, color_accent,
            footer_text, company_website, company_phone
          )
        `)
        .eq("id", r.tour_id)
        .maybeSingle();

      const bookingIds: string[] = Array.isArray(r.booking_ids) ? r.booking_ids : [];
      const { data: bookings } = bookingIds.length
        ? await supabase
            .from("bookings")
            .select(`
              id, group_name, invoice_reference, passenger_count,
              lead:customers!bookings_lead_passenger_id_fkey ( first_name, last_name, email ),
              pax2:customers!bookings_passenger_2_id_fkey ( first_name, last_name, email )
            `)
            .in("id", bookingIds)
        : { data: [] as any[] };

      const lead = (bookings ?? [])[0]?.lead;
      const recipient = overrideRecipient || r.recipient_email || lead?.email;
      if (!recipient) {
        errors++;
        await supabase.from("instalment_reminders")
          .update({ send_error: "no_recipient_email" }).eq("id", r.id);
        continue;
      }

      const pax2Email = (bookings ?? [])[0]?.pax2?.email;
      const ccList = pax2Email && pax2Email.toLowerCase() !== String(recipient).toLowerCase()
        ? [pax2Email] : undefined;

      const brand = (tour as any)?.brand || defaultBrandRow || null;
      const brandSender = clean(brand?.sender_name);
      const brandFrom = clean(brand?.from_email_client);
      const fromField = brandSender && brandFrom ? `${brandSender} <${brandFrom}>` : fallbackFromField;

      const currency = r.currency_code || "AUD";
      const passengerNames = (bookings ?? [])
        .flatMap((b: any) => [
          [b.lead?.first_name, b.lead?.last_name].filter(Boolean).join(" "),
          [b.pax2?.first_name, b.pax2?.last_name].filter(Boolean).join(" "),
        ])
        .filter(Boolean)
        .join(", ");
      const bookingRefs = (bookings ?? [])
        .map((b: any) => b.invoice_reference || b.group_name)
        .filter(Boolean)
        .join(", ");

      const balanceAfter = Math.max(0, Number(r.amount_due) - Number(r.shortfall));

      const vars: Record<string, string> = {
        recipient_name: r.recipient_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(" "),
        lead_passenger_first_name: lead?.first_name || "",
        lead_passenger_last_name: lead?.last_name || "",
        passenger_names: passengerNames,
        pax_count: String(r.pax_count ?? ""),
        booking_reference: bookingRefs,
        tour_name: (tour as any)?.name || "",
        tour_start_date: formatDateAU((tour as any)?.start_date ?? null),
        tour_end_date: formatDateAU((tour as any)?.end_date ?? null),
        final_payment_date: formatDateAU((tour as any)?.final_payment_date ?? null),
        invoice_number: r.xero_invoice_number || "",
        invoice_total: formatMoney(Number(r.invoice_total) || 0),
        invoice_amount_paid: formatMoney(Number(r.amount_paid) || 0),
        invoice_amount_due: formatMoney(Number(r.amount_due) || 0),
        instalment_amount_due: formatMoney(Number(r.shortfall) || 0),
        instalment_expected: formatMoney(Number(r.instalment_expected) || 0),
        balance_after_instalment: formatMoney(balanceAfter),
        invoice_due_date: formatDateAU(r.invoice_due_date),
        currency,
        currency_symbol: currencySymbol(currency),
        payment_link: r.payment_link || "",
        bank_details: bankDetails,
        brand_name: brand?.name || "Australian Racing Tours",
        brand_sender_name: brand?.sender_name || senderName,
        brand_header_image_url: brand?.email_header_image_url || "",
        brand_color_primary: brand?.color_primary || "#0f172a",
        brand_color_border: brand?.color_border || "#0f172a",
        brand_color_button: brand?.color_button || "#0f172a",
        brand_color_button_text: brand?.color_button_text || "#d4a017",
        brand_color_accent: brand?.color_accent || "#d4a017",
        brand_footer_text: brand?.footer_text || "",
        brand_website: brand?.company_website || "",
        brand_phone: brand?.company_phone || "",
      };

      const subject = mergeTemplate(template.subject_template || "Instalment payment due", vars);
      const html = mergeTemplate(template.content_template || "", vars);

      try {
        const result = await resend.emails.send({
          from: fromField, to: [recipient!], cc: ccList, subject, html,
        });
        if ((result as any).error) throw new Error((result as any).error?.message || "resend error");
        const messageId = (result as any).data?.id || null;

        await supabase.from("instalment_reminders").update({
          state: "sent",
          reminder_count: (Number(r.reminder_count) || 0) + 1,
          last_sent_at: new Date().toISOString(),
          next_due_at: addDays(7),
          recipient_email: recipient,
          last_email_id: messageId,
          send_error: null,
          actioned_by: actorId,
          actioned_at: new Date().toISOString(),
        }).eq("id", r.id);

        await supabase.from("email_logs").insert({
          message_id: messageId,
          booking_id: bookingIds[0] ?? null,
          tour_id: r.tour_id,
          recipient_email: recipient,
          recipient_name: vars.recipient_name,
          subject,
          template_name: template.name,
          template_id: template.id,
          rendered_html: html,
          from_email: fromField,
        });

        sent++;
        await new Promise((res) => setTimeout(res, 600)); // Resend 2/sec limit
      } catch (sendErr: any) {
        errors++;
        await supabase.from("instalment_reminders")
          .update({ send_error: sendErr?.message || String(sendErr) }).eq("id", r.id);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-instalment-reminders]", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
