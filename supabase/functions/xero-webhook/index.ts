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

  // Check if token is expired or about to expire (within 5 min)
  const expiresAt = new Date(settings.token_expires_at).getTime();
  const now = Date.now();
  
  if (now >= expiresAt - 300000) {
    // Refresh the token
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
// instalmentRequired: whether the tour has instalment_required turned on
// currentStatus: the booking's current status, used to detect second payments
function mapXeroStatusToBookingStatus(
  xeroStatus: string,
  amountDue: number,
  amountPaid: number,
  _totalAmount: number,
  instalmentRequired: boolean,
  currentStatus: string | null
): string | null {
  // Fully paid
  if (xeroStatus === 'PAID' || (amountDue === 0 && amountPaid > 0)) {
    return 'fully_paid';
  }
  // Partial payment
  if (amountPaid > 0 && amountDue > 0) {
    // If deposit already paid and tour requires instalments, this is an instalment payment
    if (instalmentRequired && currentStatus === 'deposit_paid') {
      return 'instalment_paid';
    }
    // Otherwise it's just a deposit (first partial payment, or self-spreading payments)
    return 'deposit_paid';
  }
  // Authorised but no payment yet
  if (xeroStatus === 'AUTHORISED' && amountPaid === 0) {
    return 'invoiced';
  }
  return null;
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
    // Manual sync: fetch invoices from Xero and update bookings
    if (action === 'sync-invoices') {
      const auth = await getValidAccessToken(supabase);
      if (!auth) {
        return new Response(JSON.stringify({ error: 'Xero not connected or token expired' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all bookings that have an invoice_reference, including tour's instalment_required
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, invoice_reference, status, tour_id, tours!bookings_tour_id_fkey(instalment_required)')
        .not('invoice_reference', 'is', null)
        .neq('invoice_reference', '');

      if (!bookings || bookings.length === 0) {
        return new Response(JSON.stringify({ message: 'No bookings with invoice references found', synced: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let syncedCount = 0;
      let errorCount = 0;
      const results: any[] = [];

      for (const booking of bookings) {
        try {
          // Search Xero for invoice by reference
          const invoiceResponse = await fetch(
            `https://api.xero.com/api.xro/2.0/Invoices?where=Reference=="${booking.invoice_reference}"`,
            {
              headers: {
                'Authorization': `Bearer ${auth.token}`,
                'Xero-Tenant-Id': auth.tenantId,
                'Accept': 'application/json',
              },
            }
          );

          if (!invoiceResponse.ok) {
            console.error(`Failed to fetch invoice for ref ${booking.invoice_reference}:`, await invoiceResponse.text());
            errorCount++;
            continue;
          }

          const invoiceData = await invoiceResponse.json();
          const invoices = invoiceData.Invoices || [];

          if (invoices.length === 0) {
            results.push({ booking_id: booking.id, ref: booking.invoice_reference, status: 'no_match' });
            continue;
          }

          const invoice = invoices[0];
          const amountDue = invoice.AmountDue || 0;
          const amountPaid = invoice.AmountPaid || 0;
          const total = invoice.Total || 0;

          // Upsert invoice mapping
          await supabase
            .from('xero_invoice_mappings')
            .upsert({
              booking_id: booking.id,
              xero_invoice_id: invoice.InvoiceID,
              xero_invoice_number: invoice.InvoiceNumber,
              invoice_reference: booking.invoice_reference,
              amount_due: amountDue,
              amount_paid: amountPaid,
              total_amount: total,
              currency_code: invoice.CurrencyCode || 'AUD',
              xero_status: invoice.Status,
              last_payment_date: invoice.FullyPaidOnDate || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'xero_invoice_id' });

          // Determine if booking status should update
          const instalmentRequired = !!(booking as any).tours?.instalment_required;
          const newStatus = mapXeroStatusToBookingStatus(invoice.Status, amountDue, amountPaid, total, instalmentRequired, booking.status);
          
          if (newStatus && newStatus !== booking.status) {
            const oldStatus = booking.status;
            
            // Update booking status
            await supabase
              .from('bookings')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', booking.id);

            // Log the sync action
            await supabase.from('xero_sync_log').insert({
              sync_type: 'invoice_payment',
              entity_type: 'invoice',
              entity_id: invoice.InvoiceID,
              booking_id: booking.id,
              action: 'status_updated',
              old_value: oldStatus,
              new_value: newStatus,
              details: {
                invoice_number: invoice.InvoiceNumber,
                amount_paid: amountPaid,
                amount_due: amountDue,
                total: total,
                xero_status: invoice.Status,
              },
              status: 'success',
            });

            results.push({ booking_id: booking.id, ref: booking.invoice_reference, old_status: oldStatus, new_status: newStatus });
            syncedCount++;
          } else {
            // Still update the mapping but no status change
            results.push({ booking_id: booking.id, ref: booking.invoice_reference, status: 'no_change', xero_status: invoice.Status });
          }
        } catch (bookingError) {
          console.error(`Error processing booking ${booking.id}:`, bookingError);
          errorCount++;
          
          await supabase.from('xero_sync_log').insert({
            sync_type: 'invoice_payment',
            entity_type: 'invoice',
            booking_id: booking.id,
            action: 'status_updated',
            status: 'failed',
            error_message: bookingError.message,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} bookings, ${errorCount} errors`,
        total_checked: bookings.length,
        synced: syncedCount,
        errors: errorCount,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Xero webhook handler (for future real-time updates)
    if (req.method === 'POST' && !action) {
      const body = await req.json();
      console.log('Xero webhook received:', JSON.stringify(body));

      // Xero webhook validation: respond with intent to receive
      // When Xero first sets up webhook, it sends a validation request
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
