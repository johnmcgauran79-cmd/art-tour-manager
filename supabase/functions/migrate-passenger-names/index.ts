import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationResult {
  bookingId: string;
  tourName: string;
  leadPassenger: string;
  passenger2Name: string;
  action: 'matched' | 'create_new';
  matchedContactId?: string;
  matchedContactName?: string;
  newContactFirstName?: string;
  newContactLastName?: string;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 1) {
    // Single name - use as first name, empty last name
    return { firstName: parts[0], lastName: '' };
  } else if (parts.length === 2) {
    // Standard "First Last" format
    return { firstName: parts[0], lastName: parts[1] };
  } else {
    // Multiple parts - first word is first name, rest is last name
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    console.log(`Migration mode: ${dryRun ? 'DRY RUN (preview)' : 'EXECUTE'}`);

    // Find all bookings with passenger_2_name but no passenger_2_id
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        passenger_2_name,
        lead_passenger_id,
        tours (name),
        customers!lead_passenger_id (first_name, last_name)
      `)
      .not('passenger_2_name', 'is', null)
      .neq('passenger_2_name', '')
      .is('passenger_2_id', null);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    console.log(`Found ${bookings?.length || 0} bookings with unlinked passenger_2_name`);

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No bookings found with unlinked passenger_2_name',
          results: [],
          summary: { total: 0, matched: 0, created: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all customers for matching
    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, preferred_name, email');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    const results: MigrationResult[] = [];
    let matchedCount = 0;
    let createdCount = 0;

    for (const booking of bookings) {
      const passenger2Name = booking.passenger_2_name as string;
      const { firstName, lastName } = splitName(passenger2Name);
      
      const leadPax = booking.customers as { first_name: string; last_name: string } | null;
      const leadPassengerName = leadPax 
        ? `${leadPax.first_name} ${leadPax.last_name}` 
        : 'Unknown';
      const tourName = (booking.tours as { name: string } | null)?.name || 'Unknown Tour';

      // Try to find matching customer by first + last name (case-insensitive)
      const matchedCustomer = allCustomers?.find(c => 
        c.first_name.toLowerCase() === firstName.toLowerCase() &&
        c.last_name.toLowerCase() === lastName.toLowerCase()
      );

      if (matchedCustomer) {
        matchedCount++;
        results.push({
          bookingId: booking.id,
          tourName,
          leadPassenger: leadPassengerName,
          passenger2Name,
          action: 'matched',
          matchedContactId: matchedCustomer.id,
          matchedContactName: `${matchedCustomer.first_name} ${matchedCustomer.last_name}${matchedCustomer.preferred_name ? ` (${matchedCustomer.preferred_name})` : ''}`
        });

        if (!dryRun) {
          // Update booking with matched contact
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ passenger_2_id: matchedCustomer.id })
            .eq('id', booking.id);

          if (updateError) {
            console.error(`Error updating booking ${booking.id}:`, updateError);
          } else {
            console.log(`Linked booking ${booking.id} to existing contact ${matchedCustomer.id}`);
          }
        }
      } else {
        createdCount++;
        results.push({
          bookingId: booking.id,
          tourName,
          leadPassenger: leadPassengerName,
          passenger2Name,
          action: 'create_new',
          newContactFirstName: firstName,
          newContactLastName: lastName || 'Unknown'
        });

        if (!dryRun) {
          // Create new customer
          const { data: newCustomer, error: createError } = await supabase
            .from('customers')
            .insert({
              first_name: firstName,
              last_name: lastName || 'Unknown'
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`Error creating customer for ${passenger2Name}:`, createError);
          } else if (newCustomer) {
            // Update booking with new contact
            const { error: updateError } = await supabase
              .from('bookings')
              .update({ passenger_2_id: newCustomer.id })
              .eq('id', booking.id);

            if (updateError) {
              console.error(`Error updating booking ${booking.id}:`, updateError);
            } else {
              console.log(`Created new contact ${newCustomer.id} and linked to booking ${booking.id}`);
            }
          }
        }
      }
    }

    const response = {
      success: true,
      dryRun,
      message: dryRun 
        ? `Preview complete. ${results.length} bookings would be processed.`
        : `Migration complete. ${results.length} bookings processed.`,
      summary: {
        total: results.length,
        matched: matchedCount,
        created: createdCount
      },
      results
    };

    console.log('Migration summary:', response.summary);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
