import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: get valid access token, refreshing if needed
async function getValidAccessToken(supabase: any): Promise<{ token: string; tenantId: string } | null> {
  const { data: settings } = await supabase
    .from('xero_integration_settings')
    .select('*')
    .eq('is_connected', true)
    .maybeSingle();

  if (!settings) return null;

  const expiresAt = new Date(settings.token_expires_at).getTime();
  const now = Date.now();
  
  if (now >= expiresAt - 300000) {
    const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
    const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
    
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: settings.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token refresh failed');
      return null;
    }

    const tokens = await tokenResponse.json();
    
    await supabase
      .from('xero_integration_settings')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

    return { token: tokens.access_token, tenantId: settings.tenant_id };
  }

  return { token: settings.access_token, tenantId: settings.tenant_id };
}

// Status progression order — higher number = further along, never go backwards
const STATUS_ORDER: Record<string, number> = {
  'invoiced': 1,
  'racing_breaks_invoice': 1,
  'deposited': 2,
  'instalment_paid': 3,
  'fully_paid': 4,
};

// Map Xero invoice status to booking status (never downgrades)
function mapXeroStatusToBookingStatus(
  xeroStatus: string,
  amountDue: number,
  amountPaid: number,
  _totalAmount: number,
  instalmentRequired: boolean,
  currentStatus: string | null,
  passengerCount: number = 1,
  depositPerPerson: number = 0
): string | null {
  let proposedStatus: string | null = null;

  if (xeroStatus === 'PAID' || (amountDue === 0 && amountPaid > 0)) {
    proposedStatus = 'fully_paid';
  } else if (amountPaid > 0 && amountDue > 0) {
    // Calculate total deposit threshold for this booking
    const totalDepositThreshold = passengerCount * depositPerPerson;

    if (instalmentRequired && currentStatus === 'deposited' && totalDepositThreshold > 0 && amountPaid > totalDepositThreshold) {
      // Amount paid exceeds deposit (pax × deposit_per_person) = instalment_paid
      proposedStatus = 'instalment_paid';
    } else {
      // Payment is at or below deposit level, or no deposit info available
      proposedStatus = 'deposited';
    }
  } else if (xeroStatus === 'AUTHORISED' && amountPaid === 0) {
    proposedStatus = 'invoiced';
  }

  if (!proposedStatus) return null;

  // Never downgrade: only propose if the new status is strictly higher
  const currentOrder = STATUS_ORDER[currentStatus || ''] || 0;
  const proposedOrder = STATUS_ORDER[proposedStatus] || 0;

  if (proposedOrder <= currentOrder) {
    return null; // Would be a downgrade or no change — skip
  }

  return proposedStatus;
}

// Pick the best invoice when multiple match the same Reference
function pickBestInvoice(invoices: any[]): any {
  if (invoices.length === 1) return invoices[0];
  
  // Priority: PAID > AUTHORISED > SUBMITTED > DRAFT, then newest Date
  const statusPriority: Record<string, number> = {
    'PAID': 4,
    'AUTHORISED': 3,
    'SUBMITTED': 2,
    'DRAFT': 1,
  };
  
  return invoices.sort((a, b) => {
    const aPriority = statusPriority[a.Status] || 0;
    const bPriority = statusPriority[b.Status] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    // Tie-break by Date descending
    return new Date(b.Date || 0).getTime() - new Date(a.Date || 0).getTime();
  })[0];
}

// Rate-limit-aware fetch with retry for 429 responses
async function xeroFetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, { headers });
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      const waitMs = Math.max(retryAfter * 1000, 2000) * (attempt + 1);
      console.log(`Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`);
      await response.text(); // consume body
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return response;
  }
  // Final attempt
  return await fetch(url, { headers });
}

// Fetch a single invoice ref from Xero — uses a single combined OR query to minimise API calls
// Falls back to individual queries only if combined query isn't supported
async function fetchInvoicesForRef(ref: string, auth: { token: string; tenantId: string }): Promise<any[]> {
  const headers = { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' };
  const trimmed = ref.trim();

  // Strip common prefixes to get the numeric core
  const numericCore = trimmed.replace(/^(INV-|inv-)/i, '');
  const hasPrefix = numericCore !== trimmed;

  // Build all candidate terms
  const searchTerms: string[] = [trimmed];
  if (hasPrefix && numericCore) searchTerms.push(numericCore);
  if (!hasPrefix && /^\d+$/.test(trimmed)) searchTerms.push(`INV-${trimmed}`);

  // Try a combined OR query first to use a single API call
  const orClauses = searchTerms.flatMap(term => [
    `Reference=="${term}"`,
    `InvoiceNumber=="${term}"`,
  ]);
  const combinedWhere = orClauses.join(' OR ');

  try {
    const r = await xeroFetchWithRetry(
      `https://api.xero.com/api.xro/2.0/Invoices?where=${encodeURIComponent(combinedWhere)}`,
      headers
    );
    if (r.ok) {
      const data = await r.json();
      if ((data.Invoices || []).length > 0) {
        console.log(`Matched ref "${trimmed}" via combined query (${data.Invoices.length} result(s))`);
        return data.Invoices;
      }
    } else {
      const errText = await r.text();
      console.error(`Xero API error for ref "${trimmed}" (status ${r.status}): ${errText.substring(0, 200)}`);

      // If combined query fails (e.g., syntax not supported), fall back to individual queries
      if (r.status === 400) {
        for (const term of searchTerms) {
          const r1 = await xeroFetchWithRetry(`https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${term}"`, headers);
          if (r1.ok) {
            const d1 = await r1.json();
            if ((d1.Invoices || []).length > 0) {
              console.log(`Matched ref "${trimmed}" by InvoiceNumber="${term}"`);
              return d1.Invoices;
            }
          } else {
            const errBody = await r1.text();
            console.error(`Xero API error for InvoiceNumber="${term}" (status ${r1.status}): ${errBody.substring(0, 200)}`);
          }
          await new Promise(r => setTimeout(r, 500));

          const r2 = await xeroFetchWithRetry(`https://api.xero.com/api.xro/2.0/Invoices?where=Reference=="${term}"`, headers);
          if (r2.ok) {
            const d2 = await r2.json();
            if ((d2.Invoices || []).length > 0) {
              console.log(`Matched ref "${trimmed}" by Reference="${term}"`);
              return d2.Invoices;
            }
          } else {
            const errBody = await r2.text();
            console.error(`Xero API error for Reference="${term}" (status ${r2.status}): ${errBody.substring(0, 200)}`);
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  } catch (err) {
    console.error(`Network error fetching Xero invoice for ref "${trimmed}":`, err);
  }

  return [];
}

// Fetch invoice data from Xero for all bookings with invoice references
async function fetchInvoiceProposals(supabase: any, auth: { token: string; tenantId: string }) {
  // Only check bookings for tours starting within the last 3 months or in the future
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 3);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, invoice_reference, status, tour_id, group_name, lead_passenger_id, passenger_count, tours!bookings_tour_id_fkey(instalment_required, name, start_date, deposit_required), customers!bookings_lead_passenger_id_fkey(first_name, last_name)')
    .not('invoice_reference', 'is', null)
    .neq('invoice_reference', '')
    .not('invoice_reference', 'in', '("0","TBC","tbc","N/A","n/a")')
    .gte('tours.start_date', cutoffStr);

  if (!bookings || bookings.length === 0) {
    return { proposals: [], total_checked: 0 };
  }

  const proposals: any[] = [];

  for (const booking of bookings) {
    try {
      // Split comma-separated references, skip placeholder values
      const refs = (booking.invoice_reference as string).split(',').map((r: string) => r.trim()).filter(Boolean)
        .filter((r: string) => !['0', 'TBC', 'tbc', 'N/A', 'n/a'].includes(r));
      const instalmentRequired = !!(booking as any).tours?.instalment_required;
      const depositPerPerson = (booking as any).tours?.deposit_required || 0;
      const passengerCount = booking.passenger_count || 1;

      if (refs.length === 0) continue;

      // Collect invoice data for each ref
      const invoiceResults: Array<{ invoice: any; ref: string }> = [];

      for (const ref of refs) {
        const invoices = await fetchInvoicesForRef(ref, auth);
        if (invoices.length > 0) {
          const best = pickBestInvoice(invoices);
          invoiceResults.push({ invoice: best, ref });
        } else {
          console.log(`No Xero invoice found for ref "${ref}" (booking ${booking.id})`);
        }
        await new Promise(r => setTimeout(r, 300));
      }

      if (invoiceResults.length === 0) continue;

      // For each matched invoice, compute proposed status
      const statusProposals: Array<{ status: string; order: number; invoice: any; ref: string }> = [];

      for (const { invoice, ref } of invoiceResults) {
        const amountDue = invoice.AmountDue || 0;
        const amountPaid = invoice.AmountPaid || 0;
        const total = invoice.Total || 0;
        const proposed = mapXeroStatusToBookingStatus(invoice.Status, amountDue, amountPaid, total, instalmentRequired, booking.status, passengerCount, depositPerPerson);
        if (proposed) {
          statusProposals.push({ status: proposed, order: STATUS_ORDER[proposed] || 0, invoice, ref });
        }
      }

      if (statusProposals.length === 0) continue;

      // Use LOWEST status across all invoices (least-progressed)
      statusProposals.sort((a, b) => a.order - b.order);
      const chosen = statusProposals[0];
      const invoice = chosen.invoice;

      if (chosen.status !== booking.status) {
        const customerName = booking.customers
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.group_name || 'Unknown';

        proposals.push({
          booking_id: booking.id,
          invoice_reference: booking.invoice_reference,
          invoice_number: invoice.InvoiceNumber || '',
          xero_invoice_id: invoice.InvoiceID,
          customer_name: customerName,
          tour_name: booking.tours?.name || 'Unknown Tour',
          current_status: booking.status,
          proposed_status: chosen.status,
          amount_paid: invoice.AmountPaid || 0,
          amount_due: invoice.AmountDue || 0,
          total_amount: invoice.Total || 0,
          xero_status: invoice.Status,
          currency_code: invoice.CurrencyCode || 'AUD',
          last_payment_date: invoice.FullyPaidOnDate || null,
          multiple_invoices: refs.length > 1,
          invoice_count: refs.length,
          matched_count: invoiceResults.length,
          all_statuses: statusProposals.map(s => ({ ref: s.ref, status: s.status, invoice_number: s.invoice.InvoiceNumber })),
        });
      }
    } catch (err) {
      console.error(`Error fetching invoice for booking ${booking.id}:`, err);
    }
  }

  return { proposals, total_checked: bookings.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // Diagnostic: fetch a few recent invoices to see format
    if (action === 'diagnose-format') {
      const auth = await getValidAccessToken(supabase);
      if (!auth) {
        return new Response(JSON.stringify({ error: 'Xero not connected' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const testRef = url.searchParams.get('ref') || '4137';
      const results: any = { ref_searched: testRef, queries: {} };

      // Query 1: by Reference
      const r1 = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?where=Reference=="${testRef}"`, {
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' },
      });
      const d1 = r1.ok ? await r1.json() : { error: await r1.text(), status: r1.status };
      results.queries.by_reference = { status: r1.status, count: d1.Invoices?.length || 0, invoices: (d1.Invoices || []).map((i: any) => ({ InvoiceNumber: i.InvoiceNumber, Reference: i.Reference, Status: i.Status, Total: i.Total, AmountPaid: i.AmountPaid, AmountDue: i.AmountDue })) };

      // Query 2: by InvoiceNumber exact
      const r2 = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${testRef}"`, {
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' },
      });
      const d2 = r2.ok ? await r2.json() : { error: await r2.text(), status: r2.status };
      results.queries.by_invoice_number = { status: r2.status, count: d2.Invoices?.length || 0, invoices: (d2.Invoices || []).map((i: any) => ({ InvoiceNumber: i.InvoiceNumber, Reference: i.Reference, Status: i.Status, Total: i.Total, AmountPaid: i.AmountPaid, AmountDue: i.AmountDue })) };

      // Query 3: by InvoiceNumber with INV- prefix
      const r3 = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="INV-${testRef}"`, {
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' },
      });
      const d3 = r3.ok ? await r3.json() : { error: await r3.text(), status: r3.status };
      results.queries.by_invoice_number_inv_prefix = { status: r3.status, count: d3.Invoices?.length || 0, invoices: (d3.Invoices || []).map((i: any) => ({ InvoiceNumber: i.InvoiceNumber, Reference: i.Reference, Status: i.Status, Total: i.Total, AmountPaid: i.AmountPaid, AmountDue: i.AmountDue })) };

      // Query 4: fetch 5 most recent invoices to see format
      const r4 = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?order=UpdatedDateUTC DESC&page=1`, {
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' },
      });
      const d4 = r4.ok ? await r4.json() : { error: await r4.text() };
      results.queries.recent_invoices = { count: d4.Invoices?.length || 0, sample: (d4.Invoices || []).slice(0, 5).map((i: any) => ({ InvoiceNumber: i.InvoiceNumber, Reference: i.Reference, Status: i.Status, Total: i.Total, AmountPaid: i.AmountPaid, AmountDue: i.AmountDue })) };

      console.log('Diagnostic results:', JSON.stringify(results));

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Preview mode: fetch proposals without applying
    if (action === 'preview-invoices') {
      const auth = await getValidAccessToken(supabase);
      if (!auth) {
        return new Response(JSON.stringify({ error: 'Xero not connected or token expired' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await fetchInvoiceProposals(supabase, auth);

      // Filter out dismissed proposals
      const { data: dismissals } = await supabase
        .from('invoice_sync_dismissals')
        .select('booking_id, xero_invoice_id, amount_paid_at_dismissal');

      const dismissalSet = new Set(
        (dismissals || []).map((d: any) => `${d.booking_id}|${d.xero_invoice_id}|${d.amount_paid_at_dismissal}`)
      );

      const filteredProposals = result.proposals.filter((p: any) => {
        // Key on amount_paid: if Xero amount_paid has changed since dismissal, it's a new payment scenario
        const key = `${p.booking_id}|${p.xero_invoice_id}|${p.amount_paid}`;
        return !dismissalSet.has(key);
      });

      return new Response(JSON.stringify({
        success: true,
        proposals: filteredProposals,
        total_checked: result.total_checked,
        dismissed_count: result.proposals.length - filteredProposals.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Apply approved changes + save dismissals
    if (action === 'apply-invoice-changes') {
      const body = await req.json();
      const changes: Array<{
        booking_id: string;
        new_status: string;
        xero_invoice_id: string;
        invoice_number?: string;
        invoice_reference?: string;
        amount_paid?: number;
        amount_due?: number;
        total_amount?: number;
        currency_code?: string;
        xero_status?: string;
        last_payment_date?: string;
        current_status?: string;
      }> = body.changes || [];
      const dismissals: Array<{
        booking_id: string;
        xero_invoice_id: string;
        proposed_status: string;
        current_status: string;
        dismissed_by: string;
        amount_paid: number;
        xero_status: string;
      }> = body.dismissals || [];

      // Save dismissals keyed on amount_paid so new payments clear the dismissal
      for (const d of dismissals) {
        await supabase
          .from('invoice_sync_dismissals')
          .upsert({
            booking_id: d.booking_id,
            xero_invoice_id: d.xero_invoice_id,
            proposed_status: d.proposed_status,
            current_status_at_dismissal: d.current_status,
            dismissed_by: d.dismissed_by,
            dismissed_at: new Date().toISOString(),
            amount_paid_at_dismissal: d.amount_paid,
            xero_status_at_dismissal: d.xero_status,
          }, { onConflict: 'booking_id,xero_invoice_id,amount_paid_at_dismissal' });
      }

      if (changes.length === 0) {
        return new Response(JSON.stringify({ success: true, applied: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let applied = 0;
      let errors = 0;

      for (const change of changes) {
        try {
          // Update booking status
          await supabase
            .from('bookings')
            .update({ status: change.new_status, updated_at: new Date().toISOString() })
            .eq('id', change.booking_id);

          // Upsert invoice mapping
          if (change.xero_invoice_id) {
            await supabase
              .from('xero_invoice_mappings')
              .upsert({
                booking_id: change.booking_id,
                xero_invoice_id: change.xero_invoice_id,
                xero_invoice_number: change.invoice_number,
                invoice_reference: change.invoice_reference,
                amount_due: change.amount_due || 0,
                amount_paid: change.amount_paid || 0,
                total_amount: change.total_amount || 0,
                currency_code: change.currency_code || 'AUD',
                xero_status: change.xero_status,
                last_payment_date: change.last_payment_date || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'xero_invoice_id' });
          }

          // Log the sync action
          await supabase.from('xero_sync_log').insert({
            sync_type: 'invoice_payment',
            entity_type: 'invoice',
            entity_id: change.xero_invoice_id,
            booking_id: change.booking_id,
            action: 'status_updated',
            old_value: change.current_status,
            new_value: change.new_status,
            details: {
              invoice_number: change.invoice_number,
              amount_paid: change.amount_paid,
              amount_due: change.amount_due,
              total: change.total_amount,
              xero_status: change.xero_status,
              approved_manually: true,
            },
            status: 'success',
          });

          // Save a dismissal so this proposal won't reappear on next sync
          // (keyed on amount_paid so genuinely new payments still surface)
          await supabase
            .from('invoice_sync_dismissals')
            .upsert({
              booking_id: change.booking_id,
              xero_invoice_id: change.xero_invoice_id,
              proposed_status: change.new_status,
              current_status_at_dismissal: change.current_status,
              dismissed_by: body.user_id || body.dismissals?.[0]?.dismissed_by || null,
              dismissed_at: new Date().toISOString(),
              amount_paid_at_dismissal: change.amount_paid || 0,
              xero_status_at_dismissal: change.xero_status || null,
            }, { onConflict: 'booking_id,xero_invoice_id,amount_paid_at_dismissal' });

          applied++;
        } catch (err) {
          console.error(`Error applying change for booking ${change.booking_id}:`, err);
          errors++;

          await supabase.from('xero_sync_log').insert({
            sync_type: 'invoice_payment',
            entity_type: 'invoice',
            booking_id: change.booking_id,
            action: 'status_updated',
            status: 'failed',
            error_message: err.message,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        applied,
        errors,
        message: `Applied ${applied} status changes${errors > 0 ? `, ${errors} errors` : ''}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Legacy: direct sync (kept for backward compatibility but shouldn't be used)
    if (action === 'sync-invoices') {
      return new Response(JSON.stringify({ error: 'Direct sync disabled. Use preview-invoices + apply-invoice-changes instead.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Xero webhook handler
    if (req.method === 'POST' && !action) {
      const body = await req.json();
      console.log('Xero webhook received:', JSON.stringify(body));

      await supabase.from('xero_sync_log').insert({
        sync_type: 'webhook',
        entity_type: 'webhook_event',
        action: 'received',
        details: body,
        status: 'success',
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Xero webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});