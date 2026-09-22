import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { acquireXeroLock, releaseXeroLock } from "../_shared/xeroLock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "deposit" | "instalment" | "final";

// Booking statuses never chased, per kind of reminder. A deposit is not chased
// once any payment stage has been reached; an instalment is not chased once the
// instalment (or the lot) is paid; the final balance is still chased when only
// the instalment has been paid.
const EXCLUDED_STATUSES: Record<Kind, Set<string>> = {
  deposit: new Set([
    "cancelled", "waitlisted", "host", "complimentary", "racing_breaks_invoice",
    "fully_paid", "instalment_paid", "deposited",
  ]),
  instalment: new Set([
    "cancelled", "waitlisted", "host", "complimentary", "racing_breaks_invoice",
    "fully_paid", "instalment_paid",
  ]),
  final: new Set([
    "cancelled", "waitlisted", "host", "complimentary", "racing_breaks_invoice",
    "fully_paid",
  ]),
};

// Days a booking must be unpaid before the deposit is chased.
const DEPOSIT_GRACE_DAYS = 10;
// Days between chases, per kind.
const CADENCE_DAYS: Record<Kind, number> = { deposit: 7, instalment: 14, final: 7 };
// Emails sent before the invoice is flagged for a phone call instead.
const MAX_REMINDERS = 3;

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
  const gotLock = await acquireXeroLock(supabase, lockHolder, 240);
  if (!gotLock) {
    return new Response(JSON.stringify({ success: true, skipped: true, reason: "xero_api lock held" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const autoSend = body?.auto_send !== false && !dryRun;
    const today = new Date().toISOString().split("T")[0];

    // Live invoice data is mandatory — never queue from stale cached figures.
    const auth = await getXeroAuth(supabase);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: "Xero is not connected; nothing queued." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Tours where either payment stage has arrived.
    const { data: tours, error: tourErr } = await supabase
      .from("tours")
      .select("id, name, start_date, end_date, status, instalment_required, instalment_amount, instalment_date, final_payment_date, deposit_required, manual_billing, manual_emails")
      .not("status", "in", "(past,archived,cancelled)");
    if (tourErr) throw tourErr;

    const activeTours = (tours ?? []).filter((t: any) => {
      if (t.manual_emails || t.manual_billing) return false;
      const endish = t.end_date || t.start_date;
      if (endish && endish < today) return false;
      const instalmentDue = t.instalment_required && t.instalment_date && t.instalment_date <= today
        && Number(t.instalment_amount) > 0;
      const finalDue = t.final_payment_date && t.final_payment_date <= today;
      const depositDue = Number(t.deposit_required) > 0;
      return Boolean(depositDue || instalmentDue || finalDue);
    });

    // Bookings created on or before this date have had their grace period.
    const depositCutoff = (() => {
      const d = new Date();
      d.setDate(d.getDate() - DEPOSIT_GRACE_DAYS);
      return d.toISOString().split("T")[0];
    })();

    let queued = 0;
    let updated = 0;
    let resolved = 0;
    let held = 0;
    const unlinked: any[] = [];
    const details: any[] = [];

    for (const tour of activeTours) {
      const kinds: Kind[] = [];
      if (Number(tour.deposit_required) > 0) kinds.push("deposit");
      if (tour.instalment_required && tour.instalment_date && tour.instalment_date <= today
        && Number(tour.instalment_amount) > 0) kinds.push("instalment");
      if (tour.final_payment_date && tour.final_payment_date <= today) kinds.push("final");

      const { data: bookings } = await supabase
        .from("bookings")
        .select(`
          id, status, passenger_count, group_name, invoice_reference, automation_override, created_at,
          lead:customers!bookings_lead_passenger_id_fkey ( first_name, last_name, email ),
          pax2:customers!bookings_passenger_2_id_fkey ( first_name, last_name, email ),
          pax3:customers!bookings_passenger_3_id_fkey ( first_name, last_name, email )
        `)
        .eq("tour_id", tour.id);

      // Invoice mappings for every booking on the tour (fetched once).
      const { data: mappings } = await supabase
        .from("xero_invoice_mappings")
        .select("booking_id, xero_invoice_id, xero_invoice_number")
        .in("booking_id", (bookings ?? []).map((b: any) => b.id));

      // Live invoice reads are the slow part — cache per invoice across kinds.
      const invoiceCache = new Map<string, any>();
      const linkCache = new Map<string, string | null>();

      for (const kind of kinds) {
        const chaseable = (bookings ?? []).filter((b: any) =>
          !EXCLUDED_STATUSES[kind].has(String(b.status)) &&
          b.automation_override !== "manual_emails" &&
          b.automation_override !== "manual_all" &&
          // Deposits are only chased once the booking has had its grace period.
          (kind !== "deposit" || String(b.created_at ?? "").split("T")[0] <= depositCutoff)
        );
        // Note: no early exit when nothing is chaseable — we still need to
        // clear down any reminder rows left over from before payment landed.


        const chaseableIds = new Set(chaseable.map((b: any) => b.id));

        // 2. Group bookings by invoice.
        const byInvoice = new Map<string, { number: string | null; bookings: any[] }>();
        const mappedBookingIds = new Set<string>();
        for (const m of mappings ?? []) {
          if (!m.xero_invoice_id || !chaseableIds.has(m.booking_id)) continue;
          mappedBookingIds.add(m.booking_id);
          const entry = byInvoice.get(m.xero_invoice_id) ?? { number: m.xero_invoice_number ?? null, bookings: [] };
          const booking = chaseable.find((b: any) => b.id === m.booking_id);
          if (booking && !entry.bookings.some((b: any) => b.id === booking.id)) entry.bookings.push(booking);
          byInvoice.set(m.xero_invoice_id, entry);
        }

        for (const b of chaseable) {
          if (!mappedBookingIds.has(b.id)) {
            unlinked.push({
              kind,
              tour_id: tour.id,
              tour_name: tour.name,
              booking_id: b.id,
              client: [b.lead?.first_name, b.lead?.last_name].filter(Boolean).join(" ") || b.group_name,
            });
          }
        }

        for (const [invoiceId, entry] of byInvoice) {
          // 3. Live Xero read (cached across the two kinds).
          let inv = invoiceCache.get(invoiceId);
          if (inv === undefined) {
            const invBody = await xeroGet(auth, `Invoices/${invoiceId}`);
            await new Promise((r) => setTimeout(r, 300));
            inv = invBody?.Invoices?.[0] ?? null;
            invoiceCache.set(invoiceId, inv);
          }
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
          // Instalment reminders chase only what is due at this stage; the final
          // balance chases everything still outstanding on the invoice.
          const shortfall = kind === "final"
            ? due
            : Math.max(0, depositExpected + instalmentExpected - paid);

          const existing = await supabase
            .from("instalment_reminders")
            .select("id, state, reminder_count, next_due_at, stop_reason")
            .eq("tour_id", tour.id)
            .eq("xero_invoice_id", invoiceId)
            .eq("kind", kind)
            .maybeSingle();
          const prior = existing.data;

          // Paid up, voided or nothing owing → resolve any existing row.
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

          // 4. Who is the invoice addressed to? A non-passenger means a travel
          // agent / third party billed net of commission — hold for a manual check.
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

          // Payment link (Xero online invoice), cached across kinds.
          let paymentLink = linkCache.get(invoiceId);
          if (paymentLink === undefined) {
            const online = await xeroGet(auth, `Invoices/${invoiceId}/OnlineInvoice`);
            await new Promise((r) => setTimeout(r, 300));
            paymentLink = online?.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;
            linkCache.set(invoiceId, paymentLink);
          }

          // Full line-item breakdown, used by the final balance invoice email.
          const lineItems = Array.isArray(inv.LineItems)
            ? inv.LineItems.map((li: any) => ({
                description: String(li.Description ?? ""),
                quantity: Number(li.Quantity) || 0,
                unit_amount: Number(li.UnitAmount) || 0,
                line_amount: Number(li.LineAmount) || 0,
                tax_amount: Number(li.TaxAmount) || 0,
              }))
            : [];

          const keepState = prior?.state === "needs_call" || prior?.state === "sent" ? prior.state : "pending";
          const row = {
            kind,
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
            final_payment_date: tour.final_payment_date ?? null,
            line_items: lineItems,
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            payment_link: paymentLink,
            state: isPassengerInvoice ? keepState : "held_agent",
            hold_reason: isPassengerInvoice ? null : "Invoice is addressed to a third party (likely a travel agent) — check the amount manually before sending.",
            next_due_at: prior?.next_due_at ?? today,
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
          details.push({ kind, invoice: invoiceNumber, tour: tour.name, currency, shortfall, state: row.state });
        }

        // Clear down rows that are no longer chaseable: the booking has since
        // been marked paid (so it never reached byInvoice), the invoice was
        // unlinked, or the tour no longer requires this kind of reminder.
        if (!dryRun) {
          const activeIds = Array.from(byInvoice.keys());
          let q = supabase
            .from("instalment_reminders")
            .update({ state: "resolved" })
            .eq("tour_id", tour.id)
            .eq("kind", kind)
            .in("state", ["pending", "sent", "held_agent", "needs_call"]);
          if (activeIds.length > 0) {
            q = q.not("xero_invoice_id", "in", `(${activeIds.join(",")})`);
          }
          const { data: cleared } = await q.select("id");
          resolved += cleared?.length ?? 0;
        }
      }

    }

    // 5. Automatic follow-ups. The first email on each invoice waits for a
    // person; every later chase goes out on its own until it is paid, stopped,
    // or has had MAX_REMINDERS attempts (then it is flagged for a phone call).
    let autoSent = 0;
    let flaggedForCall = 0;
    if (autoSend) {
      const { data: dueRows } = await supabase
        .from("instalment_reminders")
        .select("id, kind, reminder_count, next_due_at")
        .eq("state", "sent")
        .eq("auto_send", true)
        .gte("reminder_count", 1)
        .lte("next_due_at", today);

      const toSend = (dueRows ?? []).filter((r: any) => Number(r.reminder_count) < MAX_REMINDERS);
      const toFlag = (dueRows ?? []).filter((r: any) => Number(r.reminder_count) >= MAX_REMINDERS);

      if (toFlag.length) {
        await supabase.from("instalment_reminders").update({
          state: "needs_call",
          escalated_at: new Date().toISOString(),
          hold_reason: `No response after ${MAX_REMINDERS} emails — please phone the client and follow up personally.`,
        }).in("id", toFlag.map((r: any) => r.id));
        flaggedForCall = toFlag.length;
      }

      if (toSend.length) {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-instalment-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ action: "send", automatic: true, reminder_ids: toSend.map((x: any) => x.id) }),
        });
        const out = await r.json().catch(() => ({}));
        autoSent = Number(out?.sent) || 0;
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
        auto_sent: autoSent,
        flagged_for_call: flaggedForCall,
        cadence_days: CADENCE_DAYS,
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
