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

async function resolveXeroContact(
  supabase: any,
  auth: { token: string; tenantId: string },
  customerId: string,
  contactName: string,
  email: string | null
): Promise<{ xeroContactId: string | null; xeroContactName: string }> {
  let xeroContactId: string | null = null;
  let xeroContactName = contactName;

  // 1. Check xero_sync_log
  const { data: syncLog } = await supabase
    .from('xero_sync_log')
    .select('entity_id')
    .eq('customer_id', customerId)
    .eq('entity_type', 'contact')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (syncLog?.entity_id) {
    xeroContactId = syncLog.entity_id;
    console.log(`Found Xero contact via sync log: ${xeroContactId}`);
    return { xeroContactId, xeroContactName };
  }

  // 2. Search Xero by email
  if (email) {
    console.log(`Searching Xero for contact by email: ${email}`);
    const searchResponse = await fetch(
      `https://api.xero.com/api.xro/2.0/Contacts?where=EmailAddress=="${encodeURIComponent(email)}"`,
      {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Xero-Tenant-Id': auth.tenantId,
          'Accept': 'application/json',
        },
      }
    );
    const searchText = await searchResponse.text();
    if (searchResponse.ok) {
      const searchResult = JSON.parse(searchText);
      if (searchResult.Contacts && searchResult.Contacts.length > 0) {
        xeroContactId = searchResult.Contacts[0].ContactID;
        xeroContactName = searchResult.Contacts[0].Name || contactName;
        console.log(`Found Xero contact by email: ${xeroContactId} (${xeroContactName})`);

        await supabase.from('xero_sync_log').insert({
          sync_type: 'contact_match',
          entity_type: 'contact',
          entity_id: xeroContactId,
          customer_id: customerId,
          action: 'email_matched',
          details: { email, name: xeroContactName },
          status: 'success',
        });
      }
    }
  }

  return { xeroContactId, xeroContactName };
}

async function buildLineItems(
  supabase: any,
  booking: any,
  tour: any,
  customer: any,
  isRepeatCustomer: boolean,
  passengerQuantity: number,
  descriptionOverride?: string,
  extraNightSplitCount?: number
): Promise<any[]> {
  const lineItems: any[] = [];
  const passengerNames = descriptionOverride || buildPassengerDescription(booking, customer);
  const roomType = getRoomType(booking.hotel_bookings as any[]);

  // Fetch configurable line templates from database
  const { data: lineTemplates } = await supabase
    .from('invoice_line_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  const templates = (lineTemplates || []) as any[];
  const getTemplate = (type: string) => templates.find((t: any) => t.line_type === type);

  // Line 1: Description line
  const descTemplate = getTemplate('description');
  if (descTemplate) {
    const descText = descTemplate.description_template
      .replace('{{tour_name}}', tour.name || '')
      .replace('{{passenger_names}}', passengerNames)
      .replace('{{room_type}}', roomType);
    lineItems.push({ Description: descText, Quantity: 1, UnitAmount: 0 });
  } else {
    // Fallback if no template
    lineItems.push({ Description: `${tour.name} - ${passengerNames} - ${roomType}`, Quantity: 1, UnitAmount: 0 });
  }

  // Line 2: Product line (always from tour config, not configurable via templates)
  if (tour.xero_product_id) {
    lineItems.push({ ItemCode: tour.xero_product_id, Quantity: passengerQuantity });
  }

  // Line 3: Single supplement
  const singleSupTemplate = getTemplate('single_supplement');
  if (singleSupTemplate && passengerQuantity === 1 && booking.passenger_count === 1 && tour.price_single && tour.price_double) {
    const singleSupplement = (tour.price_single || 0) - (tour.price_double || 0);
    if (singleSupplement > 0) {
      const supDesc = singleSupTemplate.description_template
        .replace('{{tour_name}}', tour.name || '');
      lineItems.push({
        Description: supDesc,
        Quantity: 1,
        UnitAmount: singleSupplement,
      });
    }
  }

  // Line 4: Loyalty discount
  const loyaltyTemplate = getTemplate('loyalty_discount');
  if (loyaltyTemplate && isRepeatCustomer) {
    const percentage = loyaltyTemplate.unit_amount_value || 5;
    const perPersonPrice = tour.price_double || 0;
    const discountAmount = perPersonPrice * passengerQuantity * (percentage / 100);
    const discDesc = loyaltyTemplate.description_template
      .replace('{{percentage}}', String(percentage));
    lineItems.push({
      Description: discDesc,
      Quantity: 1,
      UnitAmount: -discountAmount,
    });
  }

  // Line 5: Extra nights (calculated, not template-driven)
  const hotelBookings = booking.hotel_bookings as any[];
  if (hotelBookings && hotelBookings.length > 0) {
    const tourStart = new Date(tour.start_date);
    const tourEnd = new Date(tour.end_date);
    const tourNights = Math.round((tourEnd.getTime() - tourStart.getTime()) / (1000 * 60 * 60 * 24));

    for (const hb of hotelBookings) {
      if (hb.nights && hb.nights > tourNights) {
        const extraNights = hb.nights - tourNights;

        let hotelName = 'Hotel';
        let extraNightPrice: number | null = null;
        if (hb.hotel_id) {
          const { data: hotel } = await supabase
            .from('hotels')
            .select('name, extra_night_price')
            .eq('id', hb.hotel_id)
            .maybeSingle();
          if (hotel) {
            hotelName = hotel.name;
            extraNightPrice = hotel.extra_night_price;
          }
        }

        const beddingLabel = hb.bedding
          ? hb.bedding.charAt(0).toUpperCase() + hb.bedding.slice(1) + ' Room'
          : '';

        const hbCheckIn = hb.check_in_date ? new Date(hb.check_in_date) : null;
        const hbCheckOut = hb.check_out_date ? new Date(hb.check_out_date) : null;
        const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let dateInfo = '';
        if (hbCheckIn && hbCheckIn < tourStart) {
          dateInfo = `Check-in ${formatDate(hbCheckIn)}`;
        } else if (hbCheckOut && hbCheckOut > tourEnd) {
          dateInfo = `Check-out ${formatDate(hbCheckOut)}`;
        }

        const descParts = [`Extra Nights Accommodation`, hotelName];
        if (beddingLabel) descParts.push(beddingLabel);
        if (dateInfo) descParts.push(dateInfo);

        const splitDivisor = extraNightSplitCount || 1;
        const extraLineItem: any = { Description: descParts.join('\n'), Quantity: extraNights };
        if (extraNightPrice != null) {
          extraLineItem.UnitAmount = Math.round((extraNightPrice / splitDivisor) * 100) / 100;
        }

        lineItems.push(extraLineItem);
      }
    }
  }

  // Payment Schedule line (from template)
  const paymentTemplate = getTemplate('payment_schedule');
  if (paymentTemplate) {
    const formatScheduleDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    // Build each line conditionally based on available tour data
    let templateText = paymentTemplate.description_template;
    
    // Replace variables with actual values, removing lines with missing data
    const lines = templateText.split('\\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      let processedLine = line;
      let hasData = true;
      
      if (line.includes('{{deposit_amount}}')) {
        if (tour.deposit_required) {
          processedLine = processedLine.replace('{{deposit_amount}}', Number(tour.deposit_required).toLocaleString());
        } else {
          hasData = false;
        }
      }
      if (line.includes('{{instalment_amount}}')) {
        if (tour.instalment_required && tour.instalment_amount) {
          processedLine = processedLine.replace('{{instalment_amount}}', Number(tour.instalment_amount).toLocaleString());
        } else {
          hasData = false;
        }
      }
      if (line.includes('{{instalment_date}}')) {
        if (tour.instalment_date) {
          processedLine = processedLine.replace('{{instalment_date}}', formatScheduleDate(tour.instalment_date));
        } else {
          hasData = false;
        }
      }
      if (line.includes('{{final_payment_date}}')) {
        if (tour.final_payment_date) {
          processedLine = processedLine.replace('{{final_payment_date}}', formatScheduleDate(tour.final_payment_date));
        } else {
          hasData = false;
        }
      }
      
      if (hasData) {
        processedLines.push(processedLine);
      }
    }
    
    if (processedLines.length > 1) { // More than just the header
      lineItems.push({ Description: processedLines.join('\n'), Quantity: 1, UnitAmount: 0 });
    }
  }

  // Additional info lines (cancellation policy, T&Cs, etc.)
  const infoLines = templates.filter((t: any) => t.line_type === 'info_line');
  for (const infoLine of infoLines) {
    const text = infoLine.description_template.replace(/\\n/g, '\n');
    lineItems.push({
      Description: text,
      Quantity: 1,
      UnitAmount: infoLine.unit_amount_type === 'fixed' ? (infoLine.unit_amount_value || 0) : 0,
    });
  }

  return lineItems;
}

async function createXeroInvoice(
  supabase: any,
  auth: { token: string; tenantId: string },
  xeroContact: any,
  lineItems: any[],
  reference: string,
  tourStartDate?: string
): Promise<any> {
  let dueDate: Date;
  if (tourStartDate) {
    // Set due date to 90 days before tour start date
    dueDate = new Date(tourStartDate);
    dueDate.setDate(dueDate.getDate() - 90);
    // If the calculated due date is in the past, use today + 14 days as fallback
    if (dueDate <= new Date()) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
    }
  } else {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
  }

  const invoicePayload = {
    Type: 'ACCREC',
    Contact: xeroContact,
    Date: new Date().toISOString().split('T')[0],
    DueDate: dueDate.toISOString().split('T')[0],
    LineAmountTypes: 'Inclusive',
    LineItems: lineItems,
    Reference: reference,
    Status: 'DRAFT',
  };

  console.log('Creating Xero invoice with payload:', JSON.stringify(invoicePayload));

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
    throw new Error(`Xero API error [${xeroResponse.status}]: ${xeroResponseText}`);
  }

  const xeroResult = JSON.parse(xeroResponseText);
  const createdInvoice = xeroResult.Invoices?.[0];

  if (!createdInvoice) {
    throw new Error('Xero returned no invoice data');
  }

  return createdInvoice;
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
        booking_notes, group_name, revenue, accommodation_required, whatsapp_group_comms,
        check_in_date, check_out_date, total_nights, tour_id, lead_passenger_id,
        passenger_2_name, passenger_3_name,
        passenger_2_id, passenger_3_id,
        split_invoice,
        customers:lead_passenger_id (id, first_name, last_name, email, phone),
        passenger_2:customers!passenger_2_id (id, first_name, last_name, email),
        passenger_3:customers!passenger_3_id (id, first_name, last_name, email),
        tours:tour_id (
          id, name, start_date, end_date,
          price_single, price_double, price_twin,
          xero_product_id, xero_reference, tour_type,
          deposit_required, instalment_required, instalment_amount, instalment_date, final_payment_date
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

    // Server-side guard: skip Xero invoice for host, complimentary, or non-full-tour bookings
    const skipStatuses = ['host', 'complimentary'];
    if (skipStatuses.includes(booking.status) || booking.whatsapp_group_comms === false || booking.accommodation_required === false) {
      console.log(`Skipping Xero invoice — booking ${bookingId} status: ${booking.status}, whatsapp_group_comms: ${booking.whatsapp_group_comms}, accommodation_required: ${booking.accommodation_required}`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: skipStatuses.includes(booking.status) ? `Status is ${booking.status}` : 'Non-full-tour booking' }), {
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

    // Check if repeat customer
    const { count: previousBookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('lead_passenger_id', customer.id)
      .neq('id', bookingId)
      .not('status', 'eq', 'cancelled');

    const isRepeatCustomer = (previousBookingCount || 0) > 0;
    const contactName = `${customer.first_name} ${customer.last_name}`.trim();
    const baseReference = booking.invoice_reference || tour.xero_reference || bookingId.substring(0, 8);

    // ===== SPLIT INVOICE MODE =====
    if (booking.split_invoice && booking.passenger_count > 1) {
      console.log(`Split invoice mode: creating ${booking.passenger_count} separate invoices`);

      const passengers: Array<{ customerId: string; name: string; email: string | null; role: string }> = [];

      // Lead passenger
      passengers.push({
        customerId: customer.id,
        name: contactName,
        email: customer.email,
        role: 'lead',
      });

      // Passenger 2
      const pax2 = booking.passenger_2 as any;
      if (pax2?.id) {
        passengers.push({
          customerId: pax2.id,
          name: `${pax2.first_name} ${pax2.last_name}`.trim(),
          email: pax2.email,
          role: 'passenger_2',
        });
      } else if (booking.passenger_2_name) {
        // No linked contact — invoice goes to lead passenger with pax2 name in description
        passengers.push({
          customerId: customer.id,
          name: booking.passenger_2_name,
          email: customer.email,
          role: 'passenger_2_unlinked',
        });
      }

      // Passenger 3
      if (booking.passenger_count >= 3) {
        const pax3 = booking.passenger_3 as any;
        if (pax3?.id) {
          passengers.push({
            customerId: pax3.id,
            name: `${pax3.first_name} ${pax3.last_name}`.trim(),
            email: pax3.email,
            role: 'passenger_3',
          });
        } else if (booking.passenger_3_name) {
          passengers.push({
            customerId: customer.id,
            name: booking.passenger_3_name,
            email: customer.email,
            role: 'passenger_3_unlinked',
          });
        }
      }

      const invoiceNumbers: string[] = [];
      const results: any[] = [];

      for (const pax of passengers) {
        try {
          // Resolve Xero contact for this passenger
          const { xeroContactId } = await resolveXeroContact(
            supabase, auth, pax.customerId, pax.name, pax.email
          );

          const xeroContact: any = xeroContactId
            ? { ContactID: xeroContactId }
            : { Name: pax.name, ...(pax.email ? { EmailAddress: pax.email } : {}) };

          // Check repeat status for this specific passenger
          let paxIsRepeat = isRepeatCustomer;
          if (pax.role !== 'lead') {
            const { count } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('lead_passenger_id', pax.customerId)
              .neq('id', bookingId)
              .not('status', 'eq', 'cancelled');
            paxIsRepeat = (count || 0) > 0;
          }

          const lineItems = await buildLineItems(
            supabase, booking, tour, customer, paxIsRepeat, 1, pax.name, passengers.length
          );

          const createdInvoice = await createXeroInvoice(
            supabase, auth, xeroContact, lineItems, baseReference, tour.start_date
          );

          console.log(`Split invoice created for ${pax.name}: ${createdInvoice.InvoiceNumber}`);

          // Store new Xero contact if created
          const invoiceContactId = createdInvoice.Contact?.ContactID;
          if (!xeroContactId && invoiceContactId) {
            await supabase.from('xero_sync_log').insert({
              sync_type: 'contact_auto_create',
              entity_type: 'contact',
              entity_id: invoiceContactId,
              customer_id: pax.customerId,
              action: 'auto_created_via_invoice',
              details: { name: pax.name, email: pax.email },
              status: 'success',
            });
          }

          const invoiceRef = createdInvoice.InvoiceNumber || createdInvoice.InvoiceID;
          if (invoiceRef) invoiceNumbers.push(invoiceRef);

          // Log to xero_sync_log
          await supabase.from('xero_sync_log').insert({
            sync_type: 'invoice_create',
            entity_type: 'invoice',
            entity_id: createdInvoice.InvoiceID,
            customer_id: pax.customerId,
            action: 'split_invoice_created',
            details: {
              invoice_number: createdInvoice.InvoiceNumber,
              booking_id: bookingId,
              tour_name: tour.name,
              total: createdInvoice.Total,
              passenger_role: pax.role,
              passenger_name: pax.name,
            },
            status: 'success',
          });

          results.push({
            invoiceId: createdInvoice.InvoiceID,
            invoiceNumber: createdInvoice.InvoiceNumber,
            total: createdInvoice.Total,
            passengerName: pax.name,
            passengerRole: pax.role,
          });
        } catch (err) {
          console.error(`Failed to create split invoice for ${pax.name}:`, err);
          results.push({ error: err.message, passengerName: pax.name, passengerRole: pax.role });
        }
      }

      // Update booking with all invoice numbers
      if (invoiceNumbers.length > 0) {
        const existingRef = booking.invoice_reference;
        const newRef = existingRef
          ? `${existingRef},${invoiceNumbers.join(',')}`
          : invoiceNumbers.join(',');
        await supabase
          .from('bookings')
          .update({ invoice_reference: newRef, updated_at: new Date().toISOString() })
          .eq('id', bookingId);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: customer.id,
        operation_type: 'XERO_CREATE_SPLIT_INVOICES',
        table_name: 'bookings',
        record_id: bookingId,
        details: {
          invoices_created: results.filter(r => !r.error).length,
          invoices_failed: results.filter(r => r.error).length,
          invoice_numbers: invoiceNumbers,
          split_mode: true,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        splitMode: true,
        invoices: results,
        invoiceNumbers,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== STANDARD SINGLE INVOICE MODE =====
    const { xeroContactId } = await resolveXeroContact(
      supabase, auth, customer.id, contactName, customer.email
    );

    const xeroContact: any = xeroContactId
      ? { ContactID: xeroContactId }
      : { Name: contactName, ...(customer.email ? { EmailAddress: customer.email } : {}) };

    const lineItems = await buildLineItems(
      supabase, booking, tour, customer, isRepeatCustomer, booking.passenger_count
    );

    const createdInvoice = await createXeroInvoice(
      supabase, auth, xeroContact, lineItems, baseReference, tour.start_date
    );

    console.log(`Xero invoice created: ${createdInvoice.InvoiceNumber} (ID: ${createdInvoice.InvoiceID})`);

    // Store new Xero contact if created
    const invoiceContactId = createdInvoice.Contact?.ContactID;
    if (!xeroContactId && invoiceContactId) {
      await supabase.from('xero_sync_log').insert({
        sync_type: 'contact_auto_create',
        entity_type: 'contact',
        entity_id: invoiceContactId,
        customer_id: customer.id,
        action: 'auto_created_via_invoice',
        details: { name: contactName, email: customer.email },
        status: 'success',
      });
    }

    // Update booking with invoice reference
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
        room_type: getRoomType(booking.hotel_bookings as any[]),
      },
      status: 'success',
    });

    // Audit log
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
