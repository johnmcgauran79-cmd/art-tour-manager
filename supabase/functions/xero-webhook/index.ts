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

// Map Xero invoice status to booking status
function mapXeroStatusToBookingStatus(
  xeroStatus: string,
  amountDue: number,
  amountPaid: number,
  _totalAmount: number,
  instalmentRequired: boolean,
  currentStatus: string | null
): string | null {
  if (xeroStatus === 'PAID' || (amountDue === 0 && amountPaid > 0)) {
    return 'fully_paid';
  }
  if (amountPaid > 0 && amountDue > 0) {
    if (instalmentRequired && currentStatus === 'deposit_paid') {
      return 'instalment_paid';
    }
    return 'deposit_paid';
  }
  if (xeroStatus === 'AUTHORISED' && amountPaid === 0) {
    return 'invoiced';
  }
  return null;
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

// Fetch invoice data from Xero for all bookings with invoice references
async function fetchInvoiceProposals(supabase: any, auth: { token: string; tenantId: string }) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, invoice_reference, status, tour_id, group_name, lead_passenger_id, tours!bookings_tour_id_fkey(instalment_required, name), customers!bookings_lead_passenger_id_fkey(first_name, last_name)')
    .not('invoice_reference', 'is', null)
    .neq('invoice_reference', '');

  if (!bookings || bookings.length === 0) {
    return { proposals: [], total_checked: 0 };
  }

  const proposals: any[] = [];

  // DIAGNOSTIC: On first booking, fetch recent invoices to discover format
  let diagnosticLogged = false;

  for (const booking of bookings) {
    try {
      if (!diagnosticLogged) {
        diagnosticLogged = true;
        const diagResponse = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?order=UpdatedDateUTC DESC&page=1`, {
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Xero-Tenant-Id': auth.tenantId, 'Accept': 'application/json' },
        });
        if (diagResponse.ok) {
          const diagData = await diagResponse.json();
          const sample = (diagData.Invoices || []).slice(0, 5).map((i: any) => ({
            InvoiceNumber: i.InvoiceNumber, Reference: i.Reference, Status: i.Status, Total: i.Total, AmountPaid: i.AmountPaid
          }));
          console.log('DIAGNOSTIC - Recent Xero invoices format:', JSON.stringify(sample));
        } else {
          console.error('DIAGNOSTIC - Failed to fetch recent invoices:', diagResponse.status, await diagResponse.text());
        }
        await new Promise(r => setTimeout(r, 300));
      }

      // First try matching by Reference field
      const refResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices?where=Reference=="${booking.invoice_reference}"`,
        {
          headers: {
            'Authorization': `Bearer ${auth.token}`,
            'Xero-Tenant-Id': auth.tenantId,
            'Accept': 'application/json',
          },
        }
      );

      let invoices: any[] = [];

      if (refResponse.ok) {
        const refData = await refResponse.json();
        invoices = refData.Invoices || [];
      } else {
        console.error(`Failed to fetch invoice by Reference "${booking.invoice_reference}":`, await refResponse.text());
      }

      // Fallback: search by InvoiceNumber if no Reference match
      if (invoices.length === 0) {
        await new Promise(r => setTimeout(r, 200));
        const numResponse = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${booking.invoice_reference}"`,
          {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Xero-Tenant-Id': auth.tenantId,
              'Accept': 'application/json',
            },
          }
        );

        if (numResponse.ok) {
          const numData = await numResponse.json();
          invoices = numData.Invoices || [];
          if (invoices.length > 0) {
            console.log(`Matched booking ${booking.id} by InvoiceNumber "${booking.invoice_reference}" (no Reference match)`);
          }
        } else {
          console.error(`Failed to fetch invoice by InvoiceNumber "${booking.invoice_reference}":`, await numResponse.text());
        }
      }

      // Fallback: try with common prefixes (e.g. INV-4137)
      if (invoices.length === 0) {
        const prefixes = ['INV-'];
        for (const prefix of prefixes) {
          await new Promise(r => setTimeout(r, 200));
          const prefixedRef = `${prefix}${booking.invoice_reference}`;
          const prefixResponse = await fetch(
            `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${prefixedRef}"`,
            {
              headers: {
                'Authorization': `Bearer ${auth.token}`,
                'Xero-Tenant-Id': auth.tenantId,
                'Accept': 'application/json',
              },
            }
          );

          if (prefixResponse.ok) {
            const prefixData = await prefixResponse.json();
            invoices = prefixData.Invoices || [];
            if (invoices.length > 0) {
              console.log(`Matched booking ${booking.id} by prefixed InvoiceNumber "${prefixedRef}"`);
              break;
            }
          }
        }
      }

      if (invoices.length === 0) {
        console.log(`No Xero invoice found for ref/number "${booking.invoice_reference}" (booking ${booking.id})`);
        continue;
      }

      // Rate limit between bookings
      await new Promise(r => setTimeout(r, 150));

      // Handle multiple matches: pick best invoice by status priority then date
      if (invoices.length > 1) {
        console.warn(`Multiple invoices (${invoices.length}) found for Reference "${booking.invoice_reference}" — using best match`);
      }
      const invoice = pickBestInvoice(invoices);
      
      const amountDue = invoice.AmountDue || 0;
      const amountPaid = invoice.AmountPaid || 0;
      const total = invoice.Total || 0;

      const instalmentRequired = !!(booking as any).tours?.instalment_required;
      const newStatus = mapXeroStatusToBookingStatus(invoice.Status, amountDue, amountPaid, total, instalmentRequired, booking.status);

      if (newStatus && newStatus !== booking.status) {
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
          proposed_status: newStatus,
          amount_paid: amountPaid,
          amount_due: amountDue,
          total_amount: total,
          xero_status: invoice.Status,
          currency_code: invoice.CurrencyCode || 'AUD',
          last_payment_date: invoice.FullyPaidOnDate || null,
          multiple_matches: invoices.length > 1,
          matches_count: invoices.length,
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

      return new Response(JSON.stringify({
        success: true,
        ...result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Apply approved changes
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