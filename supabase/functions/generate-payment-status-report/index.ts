import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { format = 'json' } = await req.json();

    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Get all tours for instalment/final payment info
    const { data: tours } = await supabase
      .from('tours')
      .select('id, name, start_date, instalment_required, instalment_date, final_payment_date')
      .neq('status', 'cancelled');

    const toursMap = new Map<string, any>();
    (tours || []).forEach((t: any) => toursMap.set(t.id, t));

    // Get active bookings with customer info
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        id, tour_id, status, created_at, group_name,
        customers!lead_passenger_id (first_name, last_name)
      `)
      .neq('status', 'cancelled')
      .neq('status', 'waitlisted')
      .neq('status', 'host')
      .neq('status', 'complimentary');

    const allBookings = bookings || [];

    // Deposits owing: invoiced status 7+ days
    const depositsOwing = allBookings.filter((b: any) => {
      if (b.status !== 'invoiced') return false;
      return new Date(b.created_at) < cutoffDate;
    });

    // Instalments owing
    const instalmentsOwing = allBookings.filter((b: any) => {
      const tour = toursMap.get(b.tour_id);
      if (!tour?.instalment_required || !tour.instalment_date) return false;
      if (today <= new Date(tour.instalment_date)) return false;
      return b.status !== 'instalment_paid' && b.status !== 'fully_paid';
    });

    // Final payment due
    const finalPaymentDue = allBookings.filter((b: any) => {
      const tour = toursMap.get(b.tour_id);
      if (!tour?.final_payment_date) return false;
      if (today <= new Date(tour.final_payment_date)) return false;
      return b.status !== 'fully_paid';
    });

    const totalCount = depositsOwing.length + instalmentsOwing.length + finalPaymentDue.length;

    if (format === 'json') {
      return new Response(JSON.stringify({ count: totalCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate HTML report
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const formatStatus = (status: string) => {
      return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const groupByTour = (items: any[]) => {
      const groups = new Map<string, { tourName: string; bookings: any[] }>();
      items.forEach((b: any) => {
        const tour = toursMap.get(b.tour_id);
        const tourName = tour?.name || 'Unknown Tour';
        if (!groups.has(b.tour_id)) {
          groups.set(b.tour_id, { tourName, bookings: [] });
        }
        groups.get(b.tour_id)!.bookings.push(b);
      });
      return Array.from(groups.values()).sort((a, b) => a.tourName.localeCompare(b.tourName));
    };

    const renderSection = (title: string, items: any[], color: string) => {
      if (items.length === 0) {
        return `<div style="margin-bottom: 24px;">
          <h3 style="color: ${color}; margin-bottom: 8px;">${title} (0)</h3>
          <p style="color: #888;">No outstanding issues</p>
        </div>`;
      }

      const groups = groupByTour(items);
      let html = `<div style="margin-bottom: 24px;">
        <h3 style="color: ${color}; margin-bottom: 12px;">${title} (${items.length})</h3>`;

      for (const group of groups) {
        html += `<h4 style="color: #444; margin: 12px 0 6px 0; font-size: 14px;">${group.tourName}</h4>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #ddd;">Passenger Name</th>
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #ddd;">Group</th>
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #ddd;">Booking Date</th>
              <th style="padding: 6px 10px; text-align: left; border: 1px solid #ddd;">Status</th>
            </tr>
          </thead>
          <tbody>`;

        for (const b of group.bookings) {
          const name = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : 'Unknown';
          html += `<tr>
            <td style="padding: 6px 10px; border: 1px solid #ddd;">${name}</td>
            <td style="padding: 6px 10px; border: 1px solid #ddd;">${b.group_name || '—'}</td>
            <td style="padding: 6px 10px; border: 1px solid #ddd;">${formatDate(b.created_at)}</td>
            <td style="padding: 6px 10px; border: 1px solid #ddd;">${formatStatus(b.status)}</td>
          </tr>`;
        }

        html += `</tbody></table>`;
      }

      html += `</div>`;
      return html;
    };

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p style="color: #666; margin-bottom: 16px;">Total outstanding payment issues: <strong>${totalCount}</strong></p>
        ${renderSection('Deposits Owing', depositsOwing, '#d97706')}
        ${renderSection('Instalments Owing', instalmentsOwing, '#ea580c')}
        ${renderSection('Final Payment Due', finalPaymentDue, '#dc2626')}
      </div>
    `;

    return new Response(JSON.stringify({ html, count: totalCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating payment status report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
