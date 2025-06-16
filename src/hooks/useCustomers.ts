
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  spouse_name: string | null;
  dietary_requirements: string | null;
  notes: string | null;
  crm_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Function to format Australian mobile numbers
export const formatAustralianMobile = (phone: string | null): string | null => {
  if (!phone) return phone;
  
  // Remove all non-digit characters (spaces, parentheses, dashes, etc.)
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Check if it's a 9-digit number starting with 4
  if (digitsOnly.length === 9 && digitsOnly.startsWith('4')) {
    return '0' + digitsOnly;
  }
  
  // Return the cleaned number (digits only) for other cases
  return digitsOnly || phone;
};

export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      console.log('Fetching all customers...');
      
      // Remove any limit to get ALL customers
      const { data, error, count } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });
      
      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      console.log(`Total customers fetched: ${data?.length || 0}, Database count: ${count}`);
      return data as Customer[];
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating customer with data:', customerData);
      
      // Format phone number if provided
      const formattedData = {
        ...customerData,
        phone: formatAustralianMobile(customerData.phone)
      };
      
      const { data, error } = await supabase
        .from('customers')
        .insert([formattedData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating customer:', error);
        throw error;
      }
      
      console.log('Customer created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Contact Created",
        description: `${data.first_name} ${data.last_name} has been successfully created.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in mutation:', error);
      toast({
        title: "Error Creating Contact",
        description: error.message || "Failed to create contact. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...customerData }: Partial<Customer> & { id: string }) => {
      console.log('Updating customer with data:', { id, customerData });
      
      // Format phone number if provided
      const formattedData = {
        ...customerData,
        phone: customerData.phone ? formatAustralianMobile(customerData.phone) : customerData.phone
      };
      
      const { data, error } = await supabase
        .from('customers')
        .update(formattedData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating customer:', error);
        throw error;
      }
      
      console.log('Customer updated successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Contact Updated",
        description: `${data.first_name} ${data.last_name} has been successfully updated.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in mutation:', error);
      toast({
        title: "Error Updating Contact",
        description: error.message || "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });
};

// New mutation to bulk update phone numbers
export const useBulkUpdatePhoneNumbers = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customers: Customer[]) => {
      const updates = [];
      
      for (const customer of customers) {
        const formattedPhone = formatAustralianMobile(customer.phone);
        
        // Only update if the phone number changed
        if (formattedPhone !== customer.phone) {
          updates.push({
            id: customer.id,
            phone: formattedPhone
          });
        }
      }
      
      console.log(`Updating ${updates.length} phone numbers...`);
      
      // Update each customer individually
      for (const update of updates) {
        const { error } = await supabase
          .from('customers')
          .update({ phone: update.phone })
          .eq('id', update.id);
          
        if (error) {
          console.error('Error updating customer phone:', error);
          throw error;
        }
      }
      
      return updates.length;
    },
    onSuccess: (updateCount) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (updateCount > 0) {
        toast({
          title: "Phone Numbers Updated",
          description: `Updated ${updateCount} Australian mobile number${updateCount !== 1 ? 's' : ''} to proper format.`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Error in bulk update:', error);
      toast({
        title: "Error Updating Phone Numbers",
        description: error.message || "Failed to update phone numbers. Please try again.",
        variant: "destructive",
      });
    },
  });
};
