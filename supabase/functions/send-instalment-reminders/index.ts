import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Days between chases, and how many emails before the invoice is flagged for a call.
const CADENCE_DAYS: Record<string, number> = { instalment: 14, final: 7 };
const MAX_REMINDERS = 3;

const TEMPLATE_TYPE: Record<string, string> = {
  instalment: "instalment_reminder",
  final: "final_balance",
};

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
function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Xero line descriptions arrive as plain text with real line breaks and bullet
 * lists. HTML collapses those into one run of text, so rebuild the layout:
 * headings in bold, bullet items on their own line, blank lines as spacing.
 * When a description has no line breaks at all (some Xero rows arrive flattened)
 * we split it on its own structural markers so it still reads like the invoice.
 */
function renderDescription(value: unknown): string {
  let text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  if (!text.includes("\n")) {
    text = text
      // Section headings such as "TOUR INCLUSIONS:" / "PAYMENT SCHEDULE"
      .replace(/\s+((?:[A-Z][A-Z &/']{3,}(?: [A-Z][A-Z &/']*)*)(?::|(?= ?\$)))/g, "\n\n$1")
      // Bullet items written as " - item"
      .replace(/\s+-\s+/g, "\n- ");
  }

  const lines = text.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let pendingGap = false;

  for (const line of lines) {
    if (!line) {
      if (out.length) pendingGap = true;
      continue;
    }
    const gap = pendingGap ? "margin-top:10px;" : "";
    pendingGap = false;
    const isHeading = line === line.toUpperCase() && /[A-Z]{3,}/.test(line);
    const isBullet = /^[-•]\s*/.test(line);

    if (isHeading) {
      out.push(`<div style="${gap}font-weight:600;color:#1a2332;">${escapeHtml(line)}</div>`);
    } else if (isBullet) {
      out.push(
        `<div style="${gap}padding-left:12px;text-indent:-12px;">&bull; ${escapeHtml(line.replace(/^[-•]\s*/, ""))}</div>`,
      );
    } else {
      out.push(`<div style="${gap}">${escapeHtml(line)}</div>`);
    }
  }

  return out.join("");
}

/** Full invoice breakdown table (email-safe inline styles). */
function buildLineItemsTable(
  items: any[],
  currency: string,
  totals: { total: number; paid: number; due: number },
  navy: string,
  headerText: string,
): string {
  const sym = currencySymbol(currency);
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items.map((li, i) => {
    const bg = i % 2 === 1 ? "#f3f4f6" : "#ffffff";
    const qty = Number(li.quantity) || 0;
    const unit = Number(li.unit_amount) || 0;
    const amount = Number(li.line_amount) || 0;
    // Xero invoices often carry description-only rows (no amounts) as headings —
    // render those as plain text rather than a row of zeros.
    if (unit === 0 && amount === 0) {
      return `<tr>
      <td colspan="4" style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(li.description)}</td>
    </tr>`;
    }
    return `<tr>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(li.description)}</td>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#55575d;border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top;">${qty ? qty.toLocaleString("en-AU") : ""}</td>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#55575d;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;">${sym}${formatMoney(unit)}</td>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;">${sym}${formatMoney(amount)}</td>
    </tr>`;
  }).join("");

  const totalRow = (label: string, value: number, strong = false) => `<tr>
      <td colspan="3" style="padding:8px 14px;font-size:14px;color:#1a2332;text-align:right;${strong ? "font-weight:700;" : ""}">${escapeHtml(label)}</td>
      <td style="padding:8px 14px;font-size:14px;color:#1a2332;text-align:right;${strong ? "font-weight:700;" : ""}">${sym}${formatMoney(value)}</td>
    </tr>`;

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
    <tr>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:13px;font-weight:600;">Description</th>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:center;font-size:13px;font-weight:600;width:60px;">Qty</th>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:right;font-size:13px;font-weight:600;width:110px;">Unit price</th>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:right;font-size:13px;font-weight:600;width:110px;">Amount</th>
    </tr>
    ${rows}
    ${totalRow(`Invoice total (${currency})`, totals.total)}
    ${totalRow("Payments received", totals.paid)}
    ${totalRow("Balance now due", totals.due, true)}
  </table>`;
}

interface PolicyRow { notice: string; refund: string }
function normalisePolicy(value: unknown): { title: string; rows: PolicyRow[] } {
  const fallback = {
    title: "Cancellation Policy",
    rows: [
      { notice: "180+ days prior to departure", refund: "Full refund, less 10% administration fee" },
      { notice: "90–179 days prior to departure", refund: "50% refund of all payments made" },
      { notice: "Within 90 days of departure", refund: "No refund available" },
    ],
  };
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" && v.title.trim() ? v.title : fallback.title;
  const rows = (Array.isArray(v.rows) ? v.rows : [])
    .map((r: any) => ({ notice: String(r?.notice ?? ""), refund: String(r?.refund ?? "") }))
    .filter((r) => r.notice.trim() || r.refund.trim());
  return { title, rows: rows.length ? rows : fallback.rows };
}

function buildPolicyTable(policy: { title: string; rows: PolicyRow[] }, navy: string, headerText: string): string {
  const rowsHtml = policy.rows.map((row, i) => {
    const bg = i % 2 === 1 ? "#f3f4f6" : "#ffffff";
    return `<tr>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;width:42%;vertical-align:top;">${escapeHtml(row.notice)}</td>
      <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#55575d;border-bottom:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(row.refund)}</td>
    </tr>`;
  }).join("");
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
    <tr><th colspan="2" style="padding:12px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:15px;font-weight:600;">${escapeHtml(policy.title)}</th></tr>
    <tr>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:13px;font-weight:600;width:42%;">Notice Period</th>
      <th style="padding:8px 14px;background-color:${navy};color:${headerText};text-align:left;font-size:13px;font-weight:600;">Refund</th>
    </tr>
    ${rowsHtml}
  </table>`;
}

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
    const automatic: boolean = body?.automatic === true;
    const reason: string | null = body?.reason || null;
    const actorId: string | null = body?.actor_id || null;
    const overrideRecipient: string | null =
      typeof body?.override_recipient_email === "string" && body.override_recipient_email.includes("@")
        ? body.override_recipient_email.trim()
        : null;
    // Test mode: send one copy of the real email to a staff address only. Nothing
    // is recorded against the reminder, no client or second passenger is copied.
    const testMode: boolean = body?.test_mode === true && !!overrideRecipient;


    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "reminder_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stop / skip / pause paths — no email.
    if (action === "stop" || action === "skip" || action === "pause_auto") {
      let update: Record<string, unknown>;
      if (action === "stop") {
        update = { state: "stopped", stop_reason: reason, actioned_by: actorId, actioned_at: new Date().toISOString() };
      } else if (action === "pause_auto") {
        update = { auto_send: false, actioned_by: actorId, actioned_at: new Date().toISOString() };
      } else {
        update = { next_due_at: addDays(7), actioned_by: actorId, actioned_at: new Date().toISOString() };
      }
      const { error } = await supabase.from("instalment_reminders").update(update).in("id", ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action, count: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resume") {
      const { error } = await supabase.from("instalment_reminders")
        .update({
          state: "pending", stop_reason: null, hold_reason: null, auto_send: true,
          escalated_at: null, next_due_at: new Date().toISOString().split("T")[0],
        })
        .in("id", ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action, count: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEND path
    const { data: templates } = await supabase
      .from("email_templates")
      .select("*")
      .in("type", ["instalment_reminder", "final_balance"])
      .eq("is_active", true);
    const templateByType = new Map((templates ?? []).map((t: any) => [t.type, t]));

    const { data: gs } = await supabase
      .from("general_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["default_sender_name", "default_from_email_client", "bank_details_html", "cancellation_policy"]);
    const gsMap = new Map((gs ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const clean = (v: unknown) => String(v ?? "").replace(/^"+|"+$/g, "").trim();
    const senderName = clean(gsMap.get("default_sender_name")) || "Australian Racing Tours";
    const bankDetails = clean(gsMap.get("bank_details_html"));
    const globalPolicy = normalisePolicy(gsMap.get("cancellation_policy"));

    const { data: defaultBrandRow } = await supabase
      .from("brands").select("*").eq("is_default", true).eq("is_active", true).maybeSingle();

    const { data: reminders, error: rErr } = await supabase
      .from("instalment_reminders")
      .select("*")
      .in("id", ids);
    if (rErr) throw rErr;

    let sent = 0;
    let errors = 0;
    let flaggedForCall = 0;

    for (const r of reminders ?? []) {
      if (!testMode && (r.state === "stopped" || r.state === "resolved" || r.state === "needs_call")) continue;
      if (automatic && r.auto_send === false) continue;

      const kind = r.kind === "final" ? "final" : "instalment";
      const template = templateByType.get(TEMPLATE_TYPE[kind]);
      if (!template) {
        errors++;
        await supabase.from("instalment_reminders")
          .update({ send_error: `No active ${TEMPLATE_TYPE[kind]} email template configured` }).eq("id", r.id);
        continue;
      }

      const defaultFrom = clean(template.from_email)
        || clean(gsMap.get("default_from_email_client"))
        || "bookings@australianracingtours.com.au";
      const fallbackFromField = `${senderName} <${defaultFrom}>`;

      const { data: tour } = await supabase
        .from("tours")
        .select(`
          id, name, start_date, end_date, final_payment_date, brand_id,
          cancellation_policy_override, cancellation_policy_enabled,
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
      const ccList = !testMode && pax2Email && pax2Email.toLowerCase() !== String(recipient).toLowerCase()
        ? [pax2Email] : undefined;


      const brand = (tour as any)?.brand || defaultBrandRow || null;
      const brandSender = clean(brand?.sender_name);
      const brandFrom = clean(brand?.from_email_client);
      const fromField = brandSender && brandFrom ? `${brandSender} <${brandFrom}>` : fallbackFromField;
      const navy = brand?.color_primary || "#0f172a";
      const headerText = brand?.color_button_text || "#ffffff";

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

      const policyEnabled = (tour as any)?.cancellation_policy_enabled ?? true;
      const policy = (tour as any)?.cancellation_policy_override
        ? normalisePolicy((tour as any).cancellation_policy_override)
        : globalPolicy;
      const policyHtml = policyEnabled ? buildPolicyTable(policy, navy, headerText) : "";

      const lineItemsHtml = buildLineItemsTable(
        Array.isArray(r.line_items) ? r.line_items : [],
        currency,
        { total: Number(r.invoice_total) || 0, paid: Number(r.amount_paid) || 0, due: Number(r.amount_due) || 0 },
        navy,
        headerText,
      );

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
        final_payment_date: formatDateAU(r.final_payment_date ?? (tour as any)?.final_payment_date ?? null),
        invoice_number: r.xero_invoice_number || "",
        invoice_total: formatMoney(Number(r.invoice_total) || 0),
        invoice_amount_paid: formatMoney(Number(r.amount_paid) || 0),
        invoice_amount_due: formatMoney(Number(r.amount_due) || 0),
        instalment_amount_due: formatMoney(Number(r.shortfall) || 0),
        amount_now_due: formatMoney(Number(r.shortfall) || 0),
        instalment_expected: formatMoney(Number(r.instalment_expected) || 0),
        balance_after_instalment: formatMoney(balanceAfter),
        invoice_due_date: formatDateAU(r.invoice_due_date),
        currency,
        currency_symbol: currencySymbol(currency),
        payment_link: r.payment_link || "",
        bank_details: bankDetails,
        invoice_line_items: lineItemsHtml,
        cancellation_policy: policyHtml,
        reminder_number: String((Number(r.reminder_count) || 0) + 1),
        brand_name: brand?.name || "Australian Racing Tours",
        brand_sender_name: brand?.sender_name || senderName,
        brand_header_image_url: brand?.email_header_image_url || "",
        brand_color_primary: navy,
        brand_color_border: brand?.color_border || "#0f172a",
        brand_color_button: brand?.color_button || "#0f172a",
        brand_color_button_text: brand?.color_button_text || "#d4a017",
        brand_color_accent: brand?.color_accent || "#d4a017",
        brand_footer_text: brand?.footer_text || "",
        brand_website: brand?.company_website || "",
        brand_phone: brand?.company_phone || "",
      };

      const baseSubject = mergeTemplate(
        template.subject_template || (kind === "final" ? "Final balance due" : "Instalment payment due"),
        vars,
      );
      const subject = testMode ? `[TEST] ${baseSubject}` : baseSubject;
      const html = mergeTemplate(template.content_template || "", vars);

      try {
        const result = await resend.emails.send({
          from: fromField, to: [recipient!], cc: ccList, subject, html,
        });
        if ((result as any).error) throw new Error((result as any).error?.message || "resend error");
        const messageId = (result as any).data?.id || null;

        if (!testMode) {
          const nextCount = (Number(r.reminder_count) || 0) + 1;
          const escalate = nextCount >= MAX_REMINDERS;
          if (escalate) flaggedForCall++;

          await supabase.from("instalment_reminders").update({
            state: escalate ? "needs_call" : "sent",
            hold_reason: escalate
              ? `No response after ${MAX_REMINDERS} emails — please phone the client and follow up personally.`
              : null,
            escalated_at: escalate ? new Date().toISOString() : null,
            reminder_count: nextCount,
            last_sent_at: new Date().toISOString(),
            next_due_at: addDays(CADENCE_DAYS[kind] ?? 7),
            recipient_email: recipient,
            last_email_id: messageId,
            send_error: null,
            actioned_by: automatic ? null : actorId,
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
        }

        sent++;
        await new Promise((res) => setTimeout(res, 600)); // Resend 2/sec limit
      } catch (sendErr: any) {
        errors++;
        if (!testMode) {
          await supabase.from("instalment_reminders")
            .update({ send_error: sendErr?.message || String(sendErr) }).eq("id", r.id);
        }
      }

    }

    return new Response(JSON.stringify({ success: true, sent, errors, flagged_for_call: flaggedForCall }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-instalment-reminders]", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
