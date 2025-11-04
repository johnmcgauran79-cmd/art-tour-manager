
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

export interface DuplicateGroup {
  key: string;
  contacts: Customer[];
  mergedContact: Customer;
}

// Manual notifications removed - now handled by centralized notification system

// Import the new phone formatter
import { formatPhoneForWhatsApp } from '@/utils/phoneFormatter';

// Function to format Australian mobile numbers (legacy - use formatPhoneForWhatsApp instead)
export const formatAustralianMobile = (phone: string | null): string | null => {
  return formatPhoneForWhatsApp(phone, 'AU');
};

// Function to merge contact data, preferring non-null values
const mergeContactData = (contacts: Customer[]): Customer => {
  const merged = { ...contacts[0] }; // Start with first contact
  
  contacts.forEach(contact => {
    // Merge each field, preferring non-null/non-empty values
    if (!merged.email && contact.email) merged.email = contact.email;
    if (!merged.phone && contact.phone) merged.phone = contact.phone;
    if (!merged.city && contact.city) merged.city = contact.city;
    if (!merged.state && contact.state) merged.state = contact.state;
    if (!merged.country && contact.country) merged.country = contact.country;
    if (!merged.spouse_name && contact.spouse_name) merged.spouse_name = contact.spouse_name;
    if (!merged.dietary_requirements && contact.dietary_requirements) merged.dietary_requirements = contact.dietary_requirements;
    if (!merged.crm_id && contact.crm_id) merged.crm_id = contact.crm_id;
    
    // For notes, concatenate if both exist
    if (contact.notes && contact.notes !== merged.notes) {
      if (merged.notes) {
        merged.notes = `${merged.notes}\n---\n${contact.notes}`;
      } else {
        merged.notes = contact.notes;
      }
    }
    
    // Use the most recent update date
    if (contact.updated_at > merged.updated_at) {
      merged.updated_at = contact.updated_at;
    }
  });
  
  return merged;
};

// Function to find duplicate contacts
export const findDuplicateContacts = (customers: Customer[]): DuplicateGroup[] => {
  const duplicateMap = new Map<string, Customer[]>();
  
  customers.forEach(customer => {
    const key = `${customer.first_name.toLowerCase().trim()}_${customer.last_name.toLowerCase().trim()}`;
    
    if (!duplicateMap.has(key)) {
      duplicateMap.set(key, []);
    }
    duplicateMap.get(key)!.push(customer);
  });
  
  // Only return groups with more than one contact
  const duplicateGroups: DuplicateGroup[] = [];
  duplicateMap.forEach((contacts, key) => {
    if (contacts.length > 1) {
      duplicateGroups.push({
        key,
        contacts,
        mergedContact: mergeContactData(contacts)
      });
    }
  });
  
  return duplicateGroups;
};

export const useCustomerById = (id: string | null) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching customer:', error);
        throw error;
      }
      
      return data as Customer;
    },
    enabled: !!id,
  });
};

export const useCustomers = (page: number = 1, pageSize: number = 50, searchQuery?: string) => {
  return useQuery({
    queryKey: ['customers', page, pageSize, searchQuery],
    queryFn: async () => {
      console.log('Fetching customers page:', page, 'with search:', searchQuery);
      
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      // Add search filter if provided
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim();
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%,spouse_name.ilike.%${searchTerm}%`);
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      const { data, error, count } = await query.range(start, end);
      
      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      console.log(`Fetched page ${page}: ${data?.length || 0} customers, total: ${count}`);
      return {
        customers: (data || []) as Customer[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });
};

// Keep the old hook for components that need all customers (like CSV upload)
export const useAllCustomers = () => {
  return useQuery({
    queryKey: ['all-customers'],
    queryFn: async () => {
      console.log('Fetching all customers...');
      
      let allCustomers: Customer[] = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true })
          .range(start, start + batchSize - 1);
        
        if (error) {
          console.error('Error fetching customers:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          console.log(`Fetched batch: ${data.length} customers (total so far: ${allCustomers.length})`);
          
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            start += batchSize;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Total customers fetched: ${allCustomers.length}`);
      return allCustomers as Customer[];
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...customerData }: Partial<Customer> & { id: string }) => {
      console.log('Updating customer with data:', { id, customerData });
      
      // Get the current customer data to compare dietary requirements
      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('dietary_requirements, first_name, last_name')
        .eq('id', id)
        .single();
      
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
      
      // Check if dietary requirements changed and create notification with tour context
      if (user?.id && currentCustomer && 
          currentCustomer.dietary_requirements !== customerData.dietary_requirements) {
        
        // Find the most recent booking for this customer to get tour information
        const { data: recentBooking } = await supabase
          .from('bookings')
          .select(`
            id,
            tours!inner(name)
          `)
          .eq('lead_passenger_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let message = `${currentCustomer.first_name} ${currentCustomer.last_name} dietary requirements updated`;
        let relatedId = id;

        if (recentBooking) {
          message = `${currentCustomer.first_name} ${currentCustomer.last_name} dietary requirements updated for ${recentBooking.tours.name}`;
          relatedId = recentBooking.id; // Use booking ID instead of customer ID
        }

        // Notification will be created automatically by centralized system
      }
      
      console.log('Customer updated successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting customer with id:', id);
      
      // Get customer details before deletion for notification
      const { data: customer } = await supabase
        .from('customers')
        .select('first_name, last_name')
        .eq('id', id)
        .single();
      
      // First check if the customer has any bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('lead_passenger_id', id)
        .limit(1);

      if (bookingsError) {
        console.error('Error checking for bookings:', bookingsError);
        throw new Error('Failed to check for existing bookings');
      }

      if (bookings && bookings.length > 0) {
        throw new Error('Cannot delete contact with existing tour bookings. Please cancel or transfer their bookings first.');
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting customer:', error);
        if (error.code === '23503') {
          throw new Error('Cannot delete contact as it is referenced by other records. Please remove all related bookings first.');
        }
        throw error;
      }
      
      // Create notification for deletion (not via realtime to avoid duplicates)
      // Notification will be created automatically by centralized system
      
      console.log('Customer deleted successfully');
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from all customer queries (paginated, filtered, etc.)
      queryClient.removeQueries({ queryKey: ['customers'] });
      queryClient.removeQueries({ queryKey: ['customer', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Contact Deleted",
        description: "The contact has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      console.error('Error in delete mutation:', error);
      toast({
        title: "Error Deleting Contact",
        description: error.message || "Failed to delete contact. Please try again.",
        variant: "destructive",
      });
    },
  });
};

// New mutation to merge duplicate contacts
export const useMergeDuplicateContacts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (duplicateGroups: DuplicateGroup[]) => {
      let totalMerged = 0;
      
      for (const group of duplicateGroups) {
        const { contacts, mergedContact } = group;
        
        // Keep the oldest contact (first one) and update it with merged data
        const primaryContact = contacts[0];
        const contactsToDelete = contacts.slice(1);
        
        console.log(`Merging ${contacts.length} contacts for ${mergedContact.first_name} ${mergedContact.last_name}`);
        
        // First, delete the duplicate contacts to avoid unique constraint violations
        for (const contact of contactsToDelete) {
          const { error: deleteError } = await supabase
            .from('customers')
            .delete()
            .eq('id', contact.id);
            
          if (deleteError) {
            console.error('Error deleting duplicate contact:', deleteError);
            throw deleteError;
          }
        }
        
        // Then update the primary contact with merged data
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            email: mergedContact.email,
            phone: mergedContact.phone,
            city: mergedContact.city,
            state: mergedContact.state,
            country: mergedContact.country,
            spouse_name: mergedContact.spouse_name,
            dietary_requirements: mergedContact.dietary_requirements,
            notes: mergedContact.notes,
            crm_id: mergedContact.crm_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', primaryContact.id);
          
        if (updateError) {
          console.error('Error updating primary contact:', updateError);
          throw updateError;
        }
        
        totalMerged += contactsToDelete.length;
      }
      
      return { groupsProcessed: duplicateGroups.length, contactsMerged: totalMerged };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: "Duplicates Merged Successfully",
        description: `Processed ${result.groupsProcessed} duplicate groups and merged ${result.contactsMerged} contacts.`,
      });
    },
    onError: (error: any) => {
      console.error('Error in merge duplicates:', error);
      toast({
        title: "Error Merging Duplicates",
        description: error.message || "Failed to merge duplicate contacts. Please try again.",
        variant: "destructive",
      });
    },
  });
};
