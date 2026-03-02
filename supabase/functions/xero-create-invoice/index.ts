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

function buildPassengerDescription(booking: any, customer: any): string {
  const names: string[] = [];
  const leadName = `${customer.first_name} ${customer.last_name}`.trim();
  names.push(leadName);

  if (booking.passenger_2 && booking.passenger_2.first_name) {
    names.push(`${booking.passenger_2.first_name} ${booking.passenger_2.last_name}`.trim());
  } else if (booking.passenger_2_name) {
    names.push(booking.passenger_2_name);
  }

  if (booking.passenger_3 && booking.passenger_3.first_name) {
    names.push(`${booking.passenger_3.first_name} ${booking.passenger_3.last_name}`.trim());
  } else if (booking.passenger_3_name) {
    names.push(booking.passenger_3_name);
  }

  return names.join(' & ');
}

function getRoomType(hotelBookings: any[]): string {
  if (!hotelBookings || hotelBookings.length === 0) return 'Standard';
  const bedding = hotelBookings[0]?.bedding;
  switch (bedding) {
    case 'single': return 'Single Room';
    case 'double': return 'Double Room';
    case 'twin': return 'Twin Room';
    case 'triple': return 'Triple Room';
    default: return 'Standard Room';
  }
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

    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Xero not connected or token expired. Please reconnect Xero.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch booking with all related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, passenger_count, status, invoice_reference, invoice_notes,
        booking_notes, group_name, revenue, accommodation_required,
        check_in_date, check_out_date, total_nights, tour_id, lead_passenger_id,
        passenger_2_name, passenger_3_name,
        passenger_2_id, passenger_3_id,
        customers:lead_passenger_id (id, first_name, last_name, email, phone),
        passenger_2:customers!passenger_2_id (id, first_name, last_name),
        passenger_3:customers!passenger_3_id (id, first_name, last_name),
        tours:tour_id (
          id, name, start_date, end_date,
          price_single, price_double, price_twin,
          xero_product_id, tour_type
        ),
        hotel_bookings (id, bedding, nights, check_in_date, check_out_date, hotel_id)
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

    // Build passenger names and room type for description
    const passengerNames = buildPassengerDescription(booking, customer);
    const roomType = getRoomType(booking.hotel_bookings as any[]);
    const contactName = `${customer.first_name} ${customer.last_name}`.trim();

    // Check if repeat customer (has previous completed bookings)
    const { count: previousBookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('lead_passenger_id', customer.id)
      .neq('id', bookingId)
      .not('status', 'eq', 'cancelled');

    const isRepeatCustomer = (previousBookingCount || 0) > 0;
    console.log(`Customer ${contactName}: repeat=${isRepeatCustomer} (${previousBookingCount} previous bookings)`);

    // Determine unit price based on passenger count
    const unitPrice = booking.passenger_count === 1
      ? (tour.price_single || 0)
      : (tour.price_double || 0);

    // Build line items
    const lineItems: any[] = [];

    // Line 1: Client names + room type (description-only line)
    // Line 2: Tour product line with pricing
    const tourDescription = `${tour.name} - ${passengerNames} - ${roomType}`;
    const tourLineItem: any = {
      Description: tourDescription,
      Quantity: booking.passenger_count,
      UnitAmount: unitPrice,
      AccountCode: '200',
      TaxType: 'NONE',
    };

    // If tour has a Xero product ID, use it
    if (tour.xero_product_id) {
      tourLineItem.ItemCode = tour.xero_product_id;
    }

    lineItems.push(tourLineItem);

    // Line 3: Single supplement (if 1 passenger and tour has both single & double prices)
    if (booking.passenger_count === 1 && tour.price_single && tour.price_double) {
      const singleSupplement = tour.price_single - tour.price_double;
      if (singleSupplement > 0) {
        lineItems.push({
          Description: `Single Supplement - ${tour.name}`,
          Quantity: 1,
          UnitAmount: singleSupplement,
          AccountCode: '200',
          TaxType: 'NONE',
        });
      }
    }

    // Line 4: Extra nights (check hotel bookings for additional nights beyond tour dates)
    const hotelBookings = booking.hotel_bookings as any[];
    if (hotelBookings && hotelBookings.length > 0) {
      const tourStart = new Date(tour.start_date);
      const tourEnd = new Date(tour.end_date);
      const tourNights = Math.round((tourEnd.getTime() - tourStart.getTime()) / (1000 * 60 * 60 * 24));

      for (const hb of hotelBookings) {
        if (hb.nights && hb.nights > tourNights) {
          const extraNights = hb.nights - tourNights;
          lineItems.push({
            Description: `Additional Accommodation - ${extraNights} extra night(s)`,
            Quantity: extraNights,
            UnitAmount: 0, // Price TBD - set to 0 for manual review in Xero
            AccountCode: '200',
            TaxType: 'NONE',
          });
        }
      }
    }

    // Line 5: Loyalty discount (5% for repeat customers)
    if (isRepeatCustomer) {
      const tourTotal = unitPrice * booking.passenger_count;
      const discountAmount = tourTotal * 0.05;
      lineItems.push({
        Description: `Loyalty Discount - Returning Customer (5%)`,
        Quantity: 1,
        UnitAmount: -discountAmount,
        AccountCode: '200',
        TaxType: 'NONE',
      });
    }

    // Build the invoice payload
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const invoicePayload = {
      Type: 'ACCREC',
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
        line_items_count: lineItems.length,
        is_repeat_customer: isRepeatCustomer,
        room_type: roomType,
      },
      status: 'success',
    });

    // Log to audit_log
    await supabase.from('audit_log').insert({
      user_id: customer.id,
      operation_type: 'XERO_CREATE_INVOICE',
      table_name: 'bookings',
      record_id: bookingId,
      details: {
        xero_invoice_id: createdInvoice.InvoiceID,
        xero_invoice_number: createdInvoice.InvoiceNumber,
        total: createdInvoice.Total,
        line_items: lineItems.length,
        repeat_customer_discount: isRepeatCustomer,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      invoiceId: createdInvoice.InvoiceID,
      invoiceNumber: createdInvoice.InvoiceNumber,
      total: createdInvoice.Total,
      status: createdInvoice.Status,
      lineItemsCount: lineItems.length,
      repeatCustomerDiscount: isRepeatCustomer,
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
