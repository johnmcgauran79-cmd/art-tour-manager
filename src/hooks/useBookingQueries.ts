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
  status: 'pending' | 'invoiced' | 'deposited' | 'instalment_paid' | 'fully_paid' | 'cancelled' | 'waitlisted' | 'host' | 'racing_breaks_invoice';
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
  id_number: string | null;
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
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
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

export const usePaginatedBookings = (page: number = 1, pageSize: number = 25, searchQuery: string = '') => {
  return useQuery({
    queryKey: ['bookings', 'paginated', page, pageSize, searchQuery],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      if (searchQuery.trim()) {
        const { data: allData, error: allError } = await supabase
          .from('bookings')
          .select(`
            *,
            tours (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `)
          .order('created_at', { ascending: false });
        
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
      
      const { data, error, count } = await supabase
        .from('bookings')
        .select(`
          *,
          tours (name, start_date),
          customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_conditions, accessibility_needs),
          secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
};

export const useFilteredBookings = (filterType: 'deposits_owing' | 'payment_due' | null, page: number = 1, pageSize: number = 50) => {
  const { data: settings } = useGeneralSettings();
  
  return useQuery({
    queryKey: ['bookings', 'filtered', filterType, page, pageSize, settings],
    queryFn: async () => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      const depositsOwingDays = settings?.find(s => s.setting_key === 'deposits_owing_days')?.setting_value || 14;
      const paymentDueDays = settings?.find(s => s.setting_key === 'payment_due_days')?.setting_value || 80;

      if (filterType === 'deposits_owing') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - depositsOwingDays);
        
        const { data, error, count } = await supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .eq('status', 'invoiced')
          .lt('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
        
      } else if (filterType === 'payment_due') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + paymentDueDays);
        
        const { data, error, count } = await supabase
          .from('bookings')
          .select(`
            *,
            tours!inner (name, start_date),
            customers!lead_passenger_id (id, first_name, last_name, email, phone, dietary_requirements),
            secondary_contact:customers!secondary_contact_id (id, first_name, last_name, email, phone)
          `, { count: 'exact' })
          .neq('status', 'fully_paid')
          .neq('status', 'host')
          .neq('status', 'cancelled')
          .neq('status', 'waitlisted')
          .lt('tours.start_date', cutoffDate.toISOString())
          .gte('tours.start_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .range(start, end);
        
        if (error) throw error;
        return { data: data || [], count: count || 0 };
      }

      return { data: [], count: 0 };
    },
    enabled: filterType !== null && settings !== undefined,
  });
};

export const useFilterCounts = () => {
  const { data: settings } = useGeneralSettings();
  
  return useQuery({
    queryKey: ['bookings', 'filter-counts', settings],
    queryFn: async () => {
      const depositsOwingDays = settings?.find(s => s.setting_key === 'deposits_owing_days')?.setting_value || 14;
      const paymentDueDays = settings?.find(s => s.setting_key === 'payment_due_days')?.setting_value || 80;

      const cutoffDateDeposits = new Date();
      cutoffDateDeposits.setDate(cutoffDateDeposits.getDate() - depositsOwingDays);
      
      const { count: depositsOwingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'invoiced')
        .lt('created_at', cutoffDateDeposits.toISOString());

      const cutoffDatePayments = new Date();
      cutoffDatePayments.setDate(cutoffDatePayments.getDate() + paymentDueDays);
      
      const { count: paymentDueCount } = await supabase
        .from('bookings')
        .select('*, tours!inner(start_date)', { count: 'exact', head: true })
        .neq('status', 'fully_paid')
        .neq('status', 'host')
        .neq('status', 'cancelled')
        .neq('status', 'waitlisted')
        .lt('tours.start_date', cutoffDatePayments.toISOString())
        .gte('tours.start_date', new Date().toISOString().split('T')[0]);

      return {
        depositsOwing: depositsOwingCount || 0,
        paymentDue: paymentDueCount || 0,
      };
    },
    enabled: settings !== undefined,
  });
};
