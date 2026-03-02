import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getValidAccessToken(supabase: any): Promise<{ token: string; tenantId: string; settingsId: string } | null> {
  const { data: settings } = await supabase
    .from('xero_integration_settings')
    .select('*')
    .eq('is_connected', true)
    .maybeSingle();

  if (!settings) return null;

  const expiresAt = new Date(settings.token_expires_at).getTime();
  const now = Date.now();

  // Refresh token if expiring within 5 minutes
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

    if (!tokenResponse.ok) return null;

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

    return { token: tokens.access_token, tenantId: settings.tenant_id, settingsId: settings.id };
  }

  return { token: settings.access_token, tenantId: settings.tenant_id, settingsId: settings.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating Xero invoice for booking: ${bookingId}`);

    // Get valid Xero access token
    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Xero not connected or token expired. Please reconnect Xero.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch booking with lead passenger and tour details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        passenger_count,
        status,
        invoice_reference,
        invoice_notes,
        booking_notes,
        group_name,
        revenue,
        accommodation_required,
        check_in_date,
        check_out_date,
        total_nights,
        tour_id,
        lead_passenger_id,
        customers:lead_passenger_id (
          id, first_name, last_name, email, phone
        ),
        tours:tour_id (
          id, name, start_date, end_date, price_single, price_double
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking fetch error:', bookingError);
      return new Response(JSON.stringify({ error: 'Booking not found', details: bookingError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customer = booking.customers as any;
    const tour = booking.tours as any;

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Booking has no lead passenger' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tour) {
      return new Response(JSON.stringify({ error: 'Booking has no associated tour' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine unit price based on passenger count
    const unitPrice = booking.passenger_count === 1
      ? (tour.price_single || 0)
      : (tour.price_double || 0);

    // Build the Xero contact - try to match by email first
    const contactName = `${customer.first_name} ${customer.last_name}`.trim();

    // Build line items
    const lineItems = [
      {
        Description: `${tour.name} - ${booking.passenger_count} passenger(s)${booking.group_name ? ` (${booking.group_name})` : ''}`,
        Quantity: booking.passenger_count,
        UnitAmount: unitPrice,
        AccountCode: '200', // Default sales account - adjust as needed
        TaxType: 'NONE',
      },
    ];

    // Build the invoice payload
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // Due in 14 days

    const invoicePayload = {
      Type: 'ACCREC', // Accounts Receivable (Sales Invoice)
      Contact: {
        Name: contactName,
        ...(customer.email ? { EmailAddress: customer.email } : {}),
      },
      Date: new Date().toISOString().split('T')[0],
      DueDate: dueDate.toISOString().split('T')[0],
      LineAmountTypes: 'Exclusive',
      LineItems: lineItems,
      Reference: booking.invoice_reference || bookingId.substring(0, 8),
      Status: 'DRAFT',
    };

    console.log('Creating Xero invoice with payload:', JSON.stringify(invoicePayload));

    // Create invoice in Xero
    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Xero-Tenant-Id': auth.tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ Invoices: [invoicePayload] }),
    });

    const xeroResponseText = await xeroResponse.text();

    if (!xeroResponse.ok) {
      console.error(`Xero API error [${xeroResponse.status}]:`, xeroResponseText);
      return new Response(JSON.stringify({
        error: 'Failed to create invoice in Xero',
        status: xeroResponse.status,
        details: xeroResponseText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xeroResult = JSON.parse(xeroResponseText);
    const createdInvoice = xeroResult.Invoices?.[0];

    if (!createdInvoice) {
      return new Response(JSON.stringify({ error: 'Xero returned no invoice data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Xero invoice created: ${createdInvoice.InvoiceNumber} (ID: ${createdInvoice.InvoiceID})`);

    // Update booking with the Xero invoice reference
    const invoiceRef = createdInvoice.InvoiceNumber || createdInvoice.InvoiceID;
    if (invoiceRef) {
      const existingRef = booking.invoice_reference;
      const newRef = existingRef ? `${existingRef},${invoiceRef}` : invoiceRef;

      await supabase
        .from('bookings')
        .update({ invoice_reference: newRef, updated_at: new Date().toISOString() })
        .eq('id', bookingId);
    }

    // Log to xero_sync_log
    await supabase.from('xero_sync_log').insert({
      sync_type: 'invoice_create',
      entity_type: 'invoice',
      entity_id: createdInvoice.InvoiceID,
      customer_id: customer.id,
      action: 'invoice_created',
      details: {
        invoice_number: createdInvoice.InvoiceNumber,
        booking_id: bookingId,
        tour_name: tour.name,
        total: createdInvoice.Total,
        contact_name: contactName,
      },
      status: 'success',
    });

    // Log to audit_log
    await supabase.from('audit_log').insert({
      user_id: customer.id, // Use customer ID as fallback
      operation_type: 'XERO_CREATE_INVOICE',
      table_name: 'bookings',
      record_id: bookingId,
      details: {
        xero_invoice_id: createdInvoice.InvoiceID,
        xero_invoice_number: createdInvoice.InvoiceNumber,
        total: createdInvoice.Total,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      invoiceId: createdInvoice.InvoiceID,
      invoiceNumber: createdInvoice.InvoiceNumber,
      total: createdInvoice.Total,
      status: createdInvoice.Status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating Xero invoice:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
