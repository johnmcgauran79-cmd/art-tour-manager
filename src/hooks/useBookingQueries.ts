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
  extra_requests: string | null;
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
}

export const useBookings = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      console.log('[useBookings] Starting query...');
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (name),
            customers!lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs, avatar_url),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
            passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name),
            passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name)
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
          customers!lead_passenger_id (id, first_name, last_name, preferred_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs, avatar_url),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone),
          passenger_2:customers!passenger_2_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name),
          passenger_3:customers!passenger_3_id (id, first_name, last_name, email, phone, dietary_requirements, medical_conditions, accessibility_needs, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, preferred_name)
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
          
          return leadPassengerName.includes(searchTerm) ||
                 passenger2Name.includes(searchTerm) ||
                 passenger3Name.includes(searchTerm) ||
                 groupName.includes(searchTerm) ||
                 tourName.includes(searchTerm);
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

      if (filterType === 'deposits_owing') {
        // Deposits owing: invoiced status 7+ days after booking created
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .eq('status', 'invoiced')
          .lt('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false });
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error, count } = await query.range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
        
      } else if (filterType === 'instalments_owing') {
        // Instalments owing: tour has instalment_required, past instalment_date,
        // status is not instalment_paid or fully_paid
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date, instalment_required, instalment_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .eq('tours.instalment_required', true)
          .lt('tours.instalment_date', today.toISOString().split('T')[0])
          .neq('status', 'instalment_paid')
          .neq('status', 'fully_paid')
          .neq('status', 'complimentary')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted')
          .order('created_at', { ascending: false });
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error, count } = await query.range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
        
      } else if (filterType === 'payment_due') {
        // Final payment owing: past final_payment_date and not fully_paid
        let query = supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date, final_payment_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .lt('tours.final_payment_date', today.toISOString().split('T')[0])
          .neq('status', 'fully_paid')
          .neq('status', 'complimentary')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted')
          .order('created_at', { ascending: false });
        
        // Apply tour filter
        if (tourFilter !== 'all') {
          query = query.eq('tour_id', tourFilter);
        }
        
        const { data, error, count } = await query.range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
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
      const today = new Date();
      
      // Deposits owing: invoiced status 7+ days after booking created
      const cutoffDateDeposits = new Date();
      cutoffDateDeposits.setDate(cutoffDateDeposits.getDate() - 7);
      
      const { count: depositsOwingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'invoiced')
        .lt('created_at', cutoffDateDeposits.toISOString());

      // Instalments owing: tour has instalment_required, past instalment_date,
      // status is not instalment_paid, fully_paid, or complimentary
      const { count: instalmentsOwingCount } = await supabase
        .from('bookings')
        .select('*, tours!inner(instalment_required, instalment_date)', { count: 'exact', head: true })
        .eq('tours.instalment_required', true)
        .lt('tours.instalment_date', today.toISOString().split('T')[0])
        .neq('status', 'instalment_paid')
        .neq('status', 'fully_paid')
        .neq('status', 'complimentary')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      // Final payment owing: past final_payment_date and not fully_paid or complimentary
      const { count: paymentDueCount } = await supabase
        .from('bookings')
        .select('*, tours!inner(final_payment_date)', { count: 'exact', head: true })
        .lt('tours.final_payment_date', today.toISOString().split('T')[0])
        .neq('status', 'fully_paid')
        .neq('status', 'complimentary')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted');

      return {
        depositsOwing: depositsOwingCount || 0,
        instalmentsOwing: instalmentsOwingCount || 0,
        paymentDue: paymentDueCount || 0,
      };
    },
  });
};
