import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { acquireXeroLock, releaseXeroLock } from "../_shared/xeroLock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Booking statuses that are never chased for an instalment.
const EXCLUDED_STATUSES = new Set([
  "cancelled",
  "waitlisted",
  "host",
  "complimentary",
  "racing_breaks_invoice",
  "fully_paid",
  "instalment_paid",
]);

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

async function xeroGet(auth: { token: string; tenantId: string }, path: string): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
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
    return await r.json();
  }
  return null;
}

function parseXeroDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/\/Date\((-?\d+)/);
  if (m) return new Date(Number(m[1])).toISOString().split("T")[0];
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const lockHolder = `queue-instalment-reminders:${crypto.randomUUID()}`;
  const gotLock = await acquireXeroLock(supabase, lockHolder, 120);
  if (!gotLock) {
    return new Response(JSON.stringify({ success: true, skipped: true, reason: "xero_api lock held" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const today = new Date().toISOString().split("T")[0];

    // Live invoice data is mandatory — never queue from stale cached figures.
    const auth = await getXeroAuth(supabase);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: "Xero is not connected; nothing queued." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Tours that require an instalment whose instalment date has arrived.
    const { data: tours, error: tourErr } = await supabase
      .from("tours")
      .select("id, name, start_date, end_date, status, instalment_required, instalment_amount, instalment_date, final_payment_date, deposit_required, manual_billing, manual_emails")
      .eq("instalment_required", true)
      .not("instalment_date", "is", null)
      .lte("instalment_date", today)
      .not("status", "in", "(past,archived,cancelled)");
    if (tourErr) throw tourErr;

    const activeTours = (tours ?? []).filter((t: any) => {
      if (t.manual_emails || t.manual_billing) return false;
      if (!t.instalment_amount || Number(t.instalment_amount) <= 0) return false;
      const endish = t.end_date || t.start_date;
      return !endish || endish >= today;
    });

    let queued = 0;
    let updated = 0;
    let resolved = 0;
    let held = 0;
    const unlinked: any[] = [];
    const details: any[] = [];

    for (const tour of activeTours) {
      // 2. Chaseable bookings on this tour.
      const { data: bookings } = await supabase
        .from("bookings")
        .select(`
          id, status, passenger_count, group_name, invoice_reference, automation_override,
          lead:customers!bookings_lead_passenger_id_fkey ( first_name, last_name, email ),
          pax2:customers!bookings_passenger_2_id_fkey ( first_name, last_name, email ),
          pax3:customers!bookings_passenger_3_id_fkey ( first_name, last_name, email )
        `)
        .eq("tour_id", tour.id);

      const chaseable = (bookings ?? []).filter((b: any) =>
        !EXCLUDED_STATUSES.has(String(b.status)) &&
        b.automation_override !== "manual_emails" &&
        b.automation_override !== "manual_all"
      );
      if (chaseable.length === 0) continue;

      const { data: mappings } = await supabase
        .from("xero_invoice_mappings")
        .select("booking_id, xero_invoice_id, xero_invoice_number")
        .in("booking_id", chaseable.map((b: any) => b.id));

      // 3. Group bookings by invoice.
      const byInvoice = new Map<string, { number: string | null; bookings: any[] }>();
      const mappedBookingIds = new Set<string>();
      for (const m of mappings ?? []) {
        if (!m.xero_invoice_id) continue;
        mappedBookingIds.add(m.booking_id);
        const entry = byInvoice.get(m.xero_invoice_id) ?? { number: m.xero_invoice_number ?? null, bookings: [] };
        const booking = chaseable.find((b: any) => b.id === m.booking_id);
        if (booking && !entry.bookings.some((b: any) => b.id === booking.id)) entry.bookings.push(booking);
        byInvoice.set(m.xero_invoice_id, entry);
      }

      for (const b of chaseable) {
        if (!mappedBookingIds.has(b.id)) {
          unlinked.push({
            tour_id: tour.id,
            tour_name: tour.name,
            booking_id: b.id,
            client: [b.lead?.first_name, b.lead?.last_name].filter(Boolean).join(" ") || b.group_name,
          });
        }
      }

      for (const [invoiceId, entry] of byInvoice) {
        // 4. Live Xero read.
        const invBody = await xeroGet(auth, `Invoices/${invoiceId}`);
        await new Promise((r) => setTimeout(r, 300));
        const inv = invBody?.Invoices?.[0];
        if (!inv) continue; // could not confirm — try again tomorrow

        const currency = String(inv.CurrencyCode || "AUD").toUpperCase();
        const total = Number(inv.Total) || 0;
        const paid = Number(inv.AmountPaid) || 0;
        const due = Number(inv.AmountDue) || 0;
        const invoiceNumber = inv.InvoiceNumber || entry.number || null;
        const invoiceDue = parseXeroDate(inv.DueDate);
        const status = String(inv.Status || "").toUpperCase();

        const paxCount = entry.bookings.reduce((s: number, b: any) => s + (Number(b.passenger_count) || 0), 0);
        const instalmentExpected = paxCount * (Number(tour.instalment_amount) || 0);
        const depositExpected = paxCount * (Number(tour.deposit_required) || 0);
        const shortfall = Math.max(0, depositExpected + instalmentExpected - paid);

        const existing = await supabase
          .from("instalment_reminders")
          .select("id, state, reminder_count, next_due_at, stop_reason")
          .eq("tour_id", tour.id)
          .eq("xero_invoice_id", invoiceId)
          .maybeSingle();
        const prior = existing.data;

        // Paid up, voided or nothing owing → resolve any existing row, queue nothing.
        if (due <= 0 || shortfall <= 0.005 || status === "VOIDED" || status === "DELETED" || status === "PAID") {
          if (prior && prior.state !== "stopped" && prior.state !== "resolved") {
            if (!dryRun) {
              await supabase.from("instalment_reminders")
                .update({ state: "resolved", amount_paid: paid, amount_due: due, invoice_total: total })
                .eq("id", prior.id);
            }
            resolved++;
          }
          continue;
        }

        // Admin stopped this invoice (payment plan agreed) — leave it alone.
        if (prior?.state === "stopped") continue;

        // 5. Who is the invoice addressed to? A non-passenger means a travel
        // agent / third party billed net of commission — hold for manual check.
        const contactEmail = norm(inv.Contact?.EmailAddress);
        const contactName = norm(inv.Contact?.Name);
        const passengerEmails = new Set<string>();
        const passengerNames = new Set<string>();
        for (const b of entry.bookings) {
          for (const p of [b.lead, b.pax2, b.pax3]) {
            if (p?.email) passengerEmails.add(norm(p.email));
            const n = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
            if (n) passengerNames.add(norm(n));
          }
          if (b.group_name) passengerNames.add(norm(b.group_name));
        }
        const isPassengerInvoice =
          (contactEmail && passengerEmails.has(contactEmail)) ||
          (contactName && passengerNames.has(contactName));

        const lead = entry.bookings[0]?.lead;
        const recipientEmail = contactEmail && isPassengerInvoice
          ? String(inv.Contact?.EmailAddress).trim()
          : (lead?.email ?? null);
        const recipientName = isPassengerInvoice
          ? ([lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || inv.Contact?.Name || "")
          : (inv.Contact?.Name || "");

        // Payment link (Xero online invoice).
        let paymentLink: string | null = null;
        const online = await xeroGet(auth, `Invoices/${invoiceId}/OnlineInvoice`);
        await new Promise((r) => setTimeout(r, 300));
        paymentLink = online?.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;

        const nextDue = prior?.next_due_at ?? today;
        const row = {
          tour_id: tour.id,
          xero_invoice_id: invoiceId,
          xero_invoice_number: invoiceNumber,
          booking_ids: entry.bookings.map((b: any) => b.id),
          pax_count: paxCount,
          currency_code: currency,
          invoice_total: total,
          amount_paid: paid,
          amount_due: due,
          instalment_expected: instalmentExpected,
          deposit_expected: depositExpected,
          shortfall,
          invoice_due_date: invoiceDue,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          payment_link: paymentLink,
          state: isPassengerInvoice ? (prior?.state === "sent" ? "sent" : "pending") : "held_agent",
          hold_reason: isPassengerInvoice ? null : "Invoice is addressed to a third party (likely a travel agent) — check the amount manually before sending.",
          next_due_at: nextDue,
        };

        if (!isPassengerInvoice) held++;

        if (!dryRun) {
          if (prior) {
            await supabase.from("instalment_reminders").update(row).eq("id", prior.id);
            updated++;
          } else {
            await supabase.from("instalment_reminders").insert(row);
            queued++;
          }
        }
        details.push({ invoice: invoiceNumber, tour: tour.name, currency, shortfall, state: row.state });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        tours_checked: activeTours.length,
        queued,
        updated,
        resolved,
        held_agent: held,
        unlinked_bookings: unlinked,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[queue-instalment-reminders]", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await releaseXeroLock(supabase, lockHolder);
  }
});
