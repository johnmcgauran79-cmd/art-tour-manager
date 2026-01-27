import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerAnalytics {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  total_tours: number;
  total_revenue: number;
  first_tour_date: string;
  last_tour_date: string;
  average_tour_value: number;
  is_repeat_customer: boolean;
  status_breakdown: {
    completed: number;
    pending: number;
    cancelled: number;
  };
}

export interface CustomerLifetimeStats {
  total_customers: number;
  repeat_customers: number;
  repeat_rate: number;
  average_lifetime_value: number;
  average_tours_per_customer: number;
}

export const useCustomerAnalytics = () => {
  return useQuery({
    queryKey: ["customer-analytics"],
    queryFn: async (): Promise<CustomerAnalytics[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          lead_passenger_id,
          passenger_count,
          revenue,
          status,
          created_at,
          tours!inner(start_date, name),
          customers!bookings_lead_passenger_id_fkey(first_name, last_name, email, phone)
        `)
        .not("lead_passenger_id", "is", null);

      if (error) throw error;

      // Group by customer and calculate analytics
      const customerMap = new Map<string, any>();

      data.forEach((booking: any) => {
        // Skip host bookings as they are staff, not customers
        if (booking.status === 'host') {
          return;
        }

        const customerId = booking.lead_passenger_id;
        const customer = booking.customers;
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            bookings: [],
            total_revenue: 0,
            status_breakdown: {
              completed: 0,
              pending: 0,
              cancelled: 0
            }
          });
        }

        const customerData = customerMap.get(customerId);
        customerData.bookings.push({
          revenue: booking.revenue || 0,
          status: booking.status,
          created_at: booking.created_at,
          tour_start_date: booking.tours.start_date,
          tour_name: booking.tours.name
        });

        // Update totals
        if (booking.status !== 'cancelled') {
          customerData.total_revenue += booking.revenue || 0;
        }
        
        // Update status breakdown
        if (booking.status === 'cancelled') {
          customerData.status_breakdown.cancelled++;
        } else if (booking.status === 'pending' || booking.status === 'invoiced' || booking.status === 'deposited' || booking.status === 'instalment_paid') {
          customerData.status_breakdown.pending++;
        } else if (booking.status === 'fully_paid' || booking.status === 'complimentary' || booking.status === 'waitlisted') {
          customerData.status_breakdown.completed++;
        }
      });

      // Calculate final analytics for each customer
      const analytics: CustomerAnalytics[] = Array.from(customerMap.values()).map(customer => {
        const validBookings = customer.bookings.filter((b: any) => b.status !== 'cancelled');
        const totalTours = validBookings.length;
        
        const sortedDates = validBookings
          .map((b: any) => b.tour_start_date)
          .sort();

        return {
          customer_id: customer.customer_id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          total_tours: totalTours,
          total_revenue: customer.total_revenue,
          first_tour_date: sortedDates[0] || null,
          last_tour_date: sortedDates[sortedDates.length - 1] || null,
          average_tour_value: totalTours > 0 ? customer.total_revenue / totalTours : 0,
          is_repeat_customer: totalTours > 1,
          status_breakdown: customer.status_breakdown
        };
      });

      return analytics.sort((a, b) => b.total_revenue - a.total_revenue);
    },
  });
};

export const useCustomerLifetimeStats = () => {
  return useQuery({
    queryKey: ["customer-lifetime-stats"],
    queryFn: async (): Promise<CustomerLifetimeStats> => {
      // Duplicate the analytics logic here to avoid the queryFn issue
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          lead_passenger_id,
          passenger_count,
          revenue,
          status,
          created_at,
          tours!inner(start_date, name),
          customers!bookings_lead_passenger_id_fkey(first_name, last_name, email, phone)
        `)
        .not("lead_passenger_id", "is", null);

      if (error) throw error;

      // Group by customer and calculate analytics
      const customerMap = new Map<string, any>();

      data.forEach((booking: any) => {
        // Skip host bookings as they are staff, not customers
        if (booking.status === 'host') {
          return;
        }

        const customerId = booking.lead_passenger_id;
        const customer = booking.customers;
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            bookings: [],
            total_revenue: 0,
          });
        }

        const customerData = customerMap.get(customerId);
        customerData.bookings.push({
          revenue: booking.revenue || 0,
          status: booking.status,
        });

        // Update totals
        if (booking.status !== 'cancelled') {
          customerData.total_revenue += booking.revenue || 0;
        }
      });

      // Calculate final stats
      const analytics = Array.from(customerMap.values()).map(customer => {
        const validBookings = customer.bookings.filter((b: any) => b.status !== 'cancelled');
        const totalTours = validBookings.length;
        
        return {
          total_tours: totalTours,
          total_revenue: customer.total_revenue,
          is_repeat_customer: totalTours > 1,
        };
      });

      const totalCustomers = analytics.length;
      const repeatCustomers = analytics.filter(c => c.is_repeat_customer).length;
      const totalRevenue = analytics.reduce((sum, c) => sum + c.total_revenue, 0);
      const totalTours = analytics.reduce((sum, c) => sum + c.total_tours, 0);

      return {
        total_customers: totalCustomers,
        repeat_customers: repeatCustomers,
        repeat_rate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
        average_lifetime_value: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
        average_tours_per_customer: totalCustomers > 0 ? totalTours / totalCustomers : 0
      };
    },
  });
};