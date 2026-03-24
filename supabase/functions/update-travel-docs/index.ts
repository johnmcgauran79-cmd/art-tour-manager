import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PassengerTravelDoc {
  slot: number;
  customer_id?: string;
  passport_first_name?: string;
  passport_middle_name?: string;
  passport_surname?: string;
  passport_number?: string;
  passport_expiry_date?: string;
  passport_country?: string;
  nationality?: string;
  date_of_birth?: string;
}

interface UpdateTravelDocsPayload {
  token: string;
  passengers: PassengerTravelDoc[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Fetch configurable settings
    const { data: gSettings } = await supabase
      .from('general_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_header_image_url', 'default_sender_name', 'default_from_email_client']);
    
    const getS = (key: string, fb: string) => {
      const row = (gSettings || []).find((r: any) => r.setting_key === key);
      if (!row) return fb;
      const val = row.setting_value;
      return typeof val === 'string' ? val : String(val);
    };
    
    const emailHeaderImageUrl = getS('email_header_image_url', 'https://art-tour-manager.lovable.app/images/email-header-default.png');
    const senderName = getS('default_sender_name', 'Australian Racing Tours');
    const fromEmailAddr = getS('default_from_email_client', 'bookings@australianracingtours.com.au');

    const { token, passengers }: UpdateTravelDocsPayload = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Passenger data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token - must be a travel_documents purpose token
    const { data: tokenData, error: tokenError } = await supabase
      .from("customer_access_tokens")
      .select("*, customers(*)")
      .eq("token", token)
      .eq("purpose", "travel_documents")
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token must have a booking_id for travel docs
    if (!tokenData.booking_id) {
      return new Response(
        JSON.stringify({ error: "Invalid token - no booking associated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookingId = tokenData.booking_id;
    const customer = tokenData.customers;

    // Get booking with tour info and all passengers
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id, passenger_count,
        tours(name),
        lead_passenger:customers!lead_passenger_id(id, first_name, last_name, email),
        passenger_2:customers!passenger_2_id(id, first_name, last_name, email),
        passenger_3:customers!passenger_3_id(id, first_name, last_name, email)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a map of slot -> customer for validation
    const slotToCustomer: Record<number, any> = {};
    if (booking.lead_passenger) slotToCustomer[1] = booking.lead_passenger;
    if (booking.passenger_count >= 2 && booking.passenger_2) slotToCustomer[2] = booking.passenger_2;
    if (booking.passenger_count >= 3 && booking.passenger_3) slotToCustomer[3] = booking.passenger_3;

    // Determine which slots this token owner can edit
    const tokenOwnerCustomerId = tokenData.customer_id;
    const editableSlots = Object.entries(slotToCustomer)
      .filter(([_, cust]) => cust.id === tokenOwnerCustomerId || !cust.email)
      .map(([slot, _]) => parseInt(slot));

    // Process each passenger update
    const changes: Record<number, Record<string, { old: any; new: any }>> = {};
    let totalChanges = 0;

    for (const pax of passengers) {
      const slot = pax.slot;
      
      // Validate slot is editable by this token owner
      if (!editableSlots.includes(slot)) {
        console.log(`Skipping slot ${slot} - not editable by token owner`);
        continue;
      }

      const slotCustomer = slotToCustomer[slot];
      if (!slotCustomer) continue;

      // Get existing doc for this slot
      const { data: existingDoc } = await supabase
        .from("booking_travel_docs")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("passenger_slot", slot)
        .single();

      // Track changes
      const slotChanges: Record<string, { old: any; new: any }> = {};
      const fields = ['passport_first_name', 'passport_middle_name', 'passport_surname', 'passport_number', 'passport_expiry_date', 'passport_country', 'nationality', 'date_of_birth'];
      
      for (const field of fields) {
        const newValue = pax[field as keyof PassengerTravelDoc] || null;
        const oldValue = existingDoc?.[field] || null;
        
        if (newValue !== oldValue) {
          slotChanges[field] = { old: oldValue, new: newValue };
        }
      }

      if (Object.keys(slotChanges).length === 0) {
        continue; // No changes for this passenger
      }

      changes[slot] = slotChanges;
      totalChanges += Object.keys(slotChanges).length;

      // Upsert the travel doc record
      const docData = {
        booking_id: bookingId,
        customer_id: slotCustomer.id,
        passenger_slot: slot,
        passport_first_name: pax.passport_first_name || null,
        passport_middle_name: pax.passport_middle_name || null,
        passport_surname: pax.passport_surname || null,
        passport_number: pax.passport_number || null,
        passport_expiry_date: pax.passport_expiry_date || null,
        passport_country: pax.passport_country || null,
        nationality: pax.nationality || null,
        date_of_birth: pax.date_of_birth || null,
        updated_at: new Date().toISOString(),
      };

      if (existingDoc) {
        await supabase
          .from("booking_travel_docs")
          .update(docData)
          .eq("id", existingDoc.id);
      } else {
        await supabase
          .from("booking_travel_docs")
          .insert(docData);
      }
    }

    if (totalChanges === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No changes detected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the update with IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("customer_profile_updates").insert({
      customer_id: customer.id,
      token_id: tokenData.id,
      changes: { booking_id: bookingId, travel_documents: changes },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Update token usage
    await supabase
      .from("customer_access_tokens")
      .update({ 
        last_used_at: new Date().toISOString(),
        use_count: tokenData.use_count + 1 
      })
      .eq("id", tokenData.id);

    // Send confirmation email to token owner
    const customerEmail = customer.email;
    if (resend && customerEmail) {
      // Build changes summary
      const changesHtml = Object.entries(changes)
        .map(([slot, slotChanges]) => {
          const paxName = slotToCustomer[parseInt(slot)]
            ? `${slotToCustomer[parseInt(slot)].first_name} ${slotToCustomer[parseInt(slot)].last_name}`
            : `Passenger ${slot}`;
          
          const fieldRows = Object.entries(slotChanges)
            .map(([field, { old: oldVal, new: newVal }]) => {
              const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const displayOld = oldVal || '(not provided)';
              const displayNew = newVal || '(not provided)';
              return `<tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${fieldName}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #999;">${displayOld}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; color: #2e7d32;">${displayNew}</td>
              </tr>`;
            })
            .join('');
          
          return `
            <h4 style="margin: 20px 0 10px 0; color: #333;">${paxName}</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left;">Field</th>
                  <th style="padding: 10px; text-align: left;">Previous</th>
                  <th style="padding: 10px; text-align: left;">Updated</th>
                </tr>
              </thead>
              <tbody>${fieldRows}</tbody>
            </table>
          `;
        })
        .join('');

      try {
        await resend.emails.send({
          from: "Australian Racing Tours <bookings@australianracingtours.com.au>",
          to: [customerEmail],
          subject: `Passport Details Updated - ${booking.tours?.name || 'Your Booking'}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px;">
              <div style="background: #232628; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <img src="${emailHeaderImageUrl}" alt="Australian Racing Tours" style="height: 80px; max-width: 400px; width: auto;" />
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Passport Details Updated</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin-top: 0;">Dear ${customer.first_name},</p>
                
                <p>Travel documents have been successfully updated for <strong>${booking.tours?.name || 'your booking'}</strong>. Here's a summary of the changes:</p>
                
                ${changesHtml}
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                    ✓ Travel documents have been saved securely.
                  </p>
                </div>
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #1565c0;">
                    <strong>Privacy Note:</strong> Passport details will be automatically deleted from our systems 30 days after the tour ends.
                  </p>
                </div>
                
                <p>If you didn't make these changes, please contact us immediately.</p>
                
                <p style="margin-bottom: 0;">Kind regards,<br><strong>Australian Racing Tours</strong></p>
              </div>
            </body>
            </html>
          `,
        });
        console.log("Confirmation email sent to:", customerEmail);
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Travel documents updated successfully",
        passengersUpdated: Object.keys(changes).length,
        totalChanges
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in update-travel-docs:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
