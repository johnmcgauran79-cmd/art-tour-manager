import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export interface Booking {
  id: string;
  tour_id: string;
  lead_passenger_id: string | null;
  secondary_contact_id: string | null;
  passenger_count: number;
  passenger_2_name: string | null;
  passenger_3_name: string | null;
  group_name: string | null;
  booking_agent: string | null;
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'complimentary' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice';
  booking_notes: string | null;
  invoice_notes: string | null;
  accommodation_required: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  total_nights: number | null;
  revenue: number | null;
  created_at: string;
  updated_at: string;
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  nationality: string | null;
  whatsapp_group_comms: boolean;
  selected_pickup_option_id: string | null;
}

export const useBookings = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['bookings'],
    staleTime: 2 * 60 * 1000, // 2 minutes - prevent excessive refetching
    queryFn: async () => {
      console.log('[useBookings] Starting query...');
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, tour_id, lead_passenger_id, secondary_contact_id, passenger_count,
            passenger_2_name, passenger_3_name, passenger_2_id, passenger_3_id,
            group_name, booking_agent, status, booking_notes, invoice_notes, invoice_reference,
            accommodation_required, check_in_date, check_out_date, total_nights,
            revenue, created_at, updated_at, passport_number, passport_expiry_date,
            passport_country, nationality, whatsapp_group_comms, selected_pickup_option_id,
            passport_not_required, split_invoice, id_number,
            brand_id, automation_override,
            tours (name),
            customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, avatar_url, notes),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
            passenger_2:customers!passenger_2_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes),
            passenger_3:customers!passenger_3_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name, notes)
          `)
          .order('created_at', { ascending: false });
        
        console.log('[useBookings] Query result:', { hasData: !!data, dataLength: data?.length, error: error?.message });
        if (error) {
          console.log('[useBookings] Query error details:', error);
          throw error;
        }
        return data;
      } catch (error) {
        console.log('[useBookings] Exception in query:', error);
        throw error;
      }
    },
    enabled: !!user,
  });
};

export const usePaginatedBookings = (
  page: number = 1, 
  pageSize: number = 25, 
  searchQuery: string = '',
  tourFilter: string = 'all',
  statusFilter: string = 'all'
) => {
  return useQuery({
    queryKey: ['bookings', 'paginated', page, pageSize, searchQuery, tourFilter, statusFilter],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      // Build base query
      let query = supabase
        .from('bookings')
        .select(`
          *,
          tours (name, start_date),
          customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, medical_conditions, accessibility_needs, avatar_url),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name),
          passenger_3:customers!passenger_3_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_email, preferred_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });
      
      // Apply tour filter at database level
      if (tourFilter !== 'all') {
        query = query.eq('tour_id', tourFilter);
      }
      
      // Apply status filter at database level
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      
      // If there's a search query, fetch all matching records and filter client-side
      if (searchQuery.trim()) {
        const { data: allData, error: allError } = await query;
        
        if (allError) throw allError;
        
        const searchTerm = searchQuery.toLowerCase();
        const filtered = (allData || []).filter(booking => {
          const leadPassengerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.toLowerCase();
          const passenger2Name = (booking.passenger_2_name || '').toLowerCase();
          const passenger3Name = (booking.passenger_3_name || '').toLowerCase();
          const groupName = (booking.group_name || '').toLowerCase();
          const tourName = (booking.tours?.name || '').toLowerCase();
          const invoiceReference = (booking.invoice_reference || '').toString().toLowerCase();

          return leadPassengerName.includes(searchTerm) ||
                 passenger2Name.includes(searchTerm) ||
                 passenger3Name.includes(searchTerm) ||
                 groupName.includes(searchTerm) ||
                 tourName.includes(searchTerm) ||
                 invoiceReference.includes(searchTerm);
        });
        
        const paginatedData = filtered.slice(start, end + 1);
        return { data: paginatedData, count: filtered.length };
      }
      
      // Apply pagination
      const { data, error, count } = await query.range(start, end);
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
};

// --- Outstanding payment categorisation -------------------------------------
// A booking belongs to ONE outstanding category only — the most advanced
// (most urgent) stage wins: Final Payments Owing, then Instalments Owing,
// then Deposits Owing.
const DEPOSIT_PENDING_STATUSES = ['pending', 'invoiced', 'racing_breaks_invoice'];
const SETTLED_OR_EXEMPT_STATUSES = ['fully_paid', 'complimentary', 'host', 'cancelled', 'waitlisted'];

const depositCutoffISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

const todayISO = () => new Date().toISOString().split('T')[0];

const qualifiesFinalPaymentOwing = (row: any) => {
  const tour = row.tours || {};
  if (!tour.final_payment_date) return false;
  if (!(tour.final_payment_date < todayISO())) return false;
  return !SETTLED_OR_EXEMPT_STATUSES.includes(row.status);
};

const instalmentStageOwing = (row: any) => {
  const tour = row.tours || {};
  if (!tour.instalment_required || !tour.instalment_date) return false;
  if (!(tour.instalment_date < todayISO())) return false;
  if (row.status === 'instalment_paid' || SETTLED_OR_EXEMPT_STATUSES.includes(row.status)) return false;
  return true;
};

// Instalments owing only when the final payment isn't already due
const qualifiesInstalmentsOwing = (row: any) =>
  instalmentStageOwing(row) && !qualifiesFinalPaymentOwing(row);

// Deposits owing only when neither later stage applies
const qualifiesDepositsOwing = (row: any) =>
  DEPOSIT_PENDING_STATUSES.includes(row.status) &&
  row.created_at < depositCutoffISO() &&
  !qualifiesFinalPaymentOwing(row) &&
  !instalmentStageOwing(row);


export const useFilteredBookings = (
  filterType: 'deposits_owing' | 'instalments_owing' | 'payment_due' | null, 
  page: number = 1, 
  pageSize: number = 50,
  tourFilter: string = 'all',
  statusFilter: string = 'all'
) => {
  return useQuery({
    queryKey: ['bookings', 'filtered', filterType, page, pageSize, tourFilter, statusFilter],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      const today = new Date();

      // Status priority maps (lower = higher up the list). Within each status,
      // bookings are ordered oldest-first (ascending created_at).
      const PRIORITY: Record<string, Record<string, number>> = {
        deposits_owing: { invoiced: 0, racing_breaks_invoice: 1, pending: 2 },
        instalments_owing: { invoiced: 0, deposited: 1, racing_breaks_invoice: 2, pending: 3 },
        payment_due: { invoiced: 0, deposited: 1, instalment_paid: 2, racing_breaks_invoice: 3, pending: 4 },
      };

      const sortAndPaginate = (rows: any[], key: keyof typeof PRIORITY) => {
        const priorityMap = PRIORITY[key];
        const rank = (status: string) =>
          status in priorityMap ? priorityMap[status] : 99;
        const sorted = [...rows].sort((a, b) => {
          const diff = rank(a.status) - rank(b.status);
          if (diff !== 0) return diff;
          // Oldest booking first, newest last within each status group
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        return sorted.slice(start, end + 1);
      };

      if (filterType === 'deposits_owing') {
        // Deposits owing: pre-deposit statuses 7+ days after booking created
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .in('status', ['pending', 'invoiced', 'racing_breaks_invoice'])
          .lt('created_at', cutoffDate.toISOString());
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        return { data: sortAndPaginate(data || [], 'deposits_owing'), count: count || 0 };
        
      } else if (filterType === 'instalments_owing') {
        // Instalments owing: tour has instalment_required, past instalment_date,
        // status is not instalment_paid or fully_paid
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date, instalment_required, instalment_date),
            customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .eq('tours.instalment_required', true)
          .lt('tours.instalment_date', today.toISOString().split('T')[0])
          .neq('status', 'instalment_paid')
          .neq('status', 'fully_paid')
          .neq('status', 'complimentary')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted');
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        // Exclude anything still sitting in the earlier stage (deposits owing)
        const rows = (data || []).filter((row: any) => !qualifiesDepositsOwing(row));
        return { data: sortAndPaginate(rows, 'instalments_owing'), count: rows.length };
        
      } else if (filterType === 'payment_due') {
        // Final payment owing: past final_payment_date and not fully_paid
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date, final_payment_date, instalment_required, instalment_date),
            customers!lead_passenger_id (id, title, date_of_birth, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .lt('tours.final_payment_date', today.toISOString().split('T')[0])
          .neq('status', 'fully_paid')
          .neq('status', 'complimentary')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted');
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        // Exclude anything still sitting in an earlier stage (deposit or instalment owing)
        const rows = (data || []).filter(
          (row: any) => !qualifiesDepositsOwing(row) && !qualifiesInstalmentsOwing(row)
        );
        return { data: sortAndPaginate(rows, 'payment_due'), count: rows.length };
      }

      return { data: [], count: 0 };
    },
    enabled: filterType !== null,
  });
};

export const useFilterCounts = () => {
  return useQuery({
    queryKey: ['bookings', 'filter-counts'],
    queryFn: async () => {
      const today = todayISO();
      
      // Deposits owing: pre-deposit statuses 7+ days after booking created
      const { count: depositsOwingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', DEPOSIT_PENDING_STATUSES as any)
        .lt('created_at', depositCutoffISO());

      // Instalments owing: tour has instalment_required, past instalment_date,
      // excluding anything still owing a deposit
      const { data: instalmentRows } = await supabase
        .from('bookings')
        .select('id, status, created_at, tours!inner(instalment_required, instalment_date)')
        .eq('tours.instalment_required', true)
        .lt('tours.instalment_date', today)
        .neq('status', 'instalment_paid')
        .neq('status', 'fully_paid')
        .neq('status', 'complimentary')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      const instalmentsOwing = (instalmentRows || []).filter(
        (row: any) => !qualifiesDepositsOwing(row)
      ).length;

      // Final payment owing: past final_payment_date, excluding anything still
      // owing a deposit or an instalment
      const { data: finalRows } = await supabase
        .from('bookings')
        .select('id, status, created_at, tours!inner(final_payment_date, instalment_required, instalment_date)')
        .lt('tours.final_payment_date', today)
        .neq('status', 'fully_paid')
        .neq('status', 'complimentary')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      const paymentDue = (finalRows || []).filter(
        (row: any) => !qualifiesDepositsOwing(row) && !qualifiesInstalmentsOwing(row)
      ).length;

      return {
        depositsOwing: depositsOwingCount || 0,
        instalmentsOwing,
        paymentDue,
      };
    },
  });
};
