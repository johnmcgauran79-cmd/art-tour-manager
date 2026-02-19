
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  spouse_name: string | null;
  dietary_requirements: string | null;
  notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_email: string | null;
  medical_conditions: string | null;
  accessibility_needs: string | null;
  avatar_url: string | null;
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

// Count how many useful fields a contact has filled
export const countFilledFields = (contact: Customer): number => {
  const fields = [
    contact.email, contact.phone, contact.city, contact.state, contact.country,
    contact.spouse_name, contact.dietary_requirements, contact.notes,
    contact.emergency_contact_name, contact.emergency_contact_phone,
    contact.medical_conditions, contact.accessibility_needs, contact.preferred_name,
  ];
  return fields.filter(f => f && f.trim() !== '').length;
};

// Function to find duplicate contacts
export const findDuplicateContacts = (customers: Customer[], customerIdsWithBookings?: Set<string>): DuplicateGroup[] => {
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
      // Sort: contacts with bookings first, then by most filled fields
      const sorted = [...contacts].sort((a, b) => {
        const aHasBookings = customerIdsWithBookings?.has(a.id) ? 1 : 0;
        const bHasBookings = customerIdsWithBookings?.has(b.id) ? 1 : 0;
        if (bHasBookings !== aHasBookings) return bHasBookings - aHasBookings;
        return countFilledFields(b) - countFilledFields(a);
      });
      duplicateGroups.push({
        key,
        contacts: sorted,
        mergedContact: mergeContactData(sorted)
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
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
        
        // If multiple words (likely first + last name), search for each word in name fields
        if (searchWords.length >= 2) {
          // Build a filter that matches all words across first_name and last_name
          const firstWord = searchWords[0];
          const secondWord = searchWords.slice(1).join(' ');
          
          // Match "first last" or "last first" pattern, or fallback to any field containing the full term
          query = query.or(
            `and(first_name.ilike.%${firstWord}%,last_name.ilike.%${secondWord}%),` +
            `and(first_name.ilike.%${secondWord}%,last_name.ilike.%${firstWord}%),` +
            `email.ilike.%${searchTerm}%`
          );
        } else {
          // Single word - search across all fields
          query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%,spouse_name.ilike.%${searchTerm}%`);
        }
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
      queryClient.invalidateQueries({ queryKey: ['all-customers'] });
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
        .select('id, tours(name)')
        .eq('lead_passenger_id', id)
        .limit(1);

      if (bookingsError) {
        console.error('Error checking for bookings:', bookingsError);
        throw new Error('Unable to verify if contact has bookings. Please try again.');
      }

      if (bookings && bookings.length > 0) {
        const tourName = bookings[0]?.tours?.name || 'a tour';
        throw new Error(`This contact cannot be deleted as they have an existing booking for ${tourName}. Please cancel or remove their bookings first.`);
      }

      const { error, count } = await supabase
        .from('customers')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting customer:', error);
        if (error.code === '23503') {
          throw new Error('Cannot delete contact as it is referenced by other records. Please remove all related bookings first.');
        }
        throw error;
      }
      
      // Check if deletion actually happened
      if (count === 0) {
        console.error('Deletion returned 0 rows - possible RLS policy issue');
        throw new Error('Failed to delete contact. You may not have permission to delete this contact.');
      }
      
      console.log('Customer deleted successfully, rows affected:', count);
      return id;
    },
    onSuccess: (deletedId) => {
      console.log('Delete mutation onSuccess called for:', deletedId);
      // Aggressively clear all customer-related cache
      queryClient.removeQueries({ queryKey: ['customers'] });
      queryClient.removeQueries({ queryKey: ['customer', deletedId] });
      // Force refetch of customer lists
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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

export interface BulkDeleteProgress {
  total: number;
  processed: number;
  deleted: number;
  skipped: number;
}

export const useBulkDeleteCustomers = (onProgress?: (progress: BulkDeleteProgress) => void) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = { deleted: 0, skipped: 0, errors: [] as string[] };
      const total = ids.length;

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];

        onProgress?.({ total, processed: i, deleted: results.deleted, skipped: results.skipped });
        // Yield to UI thread so React can repaint the progress bar
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));

        // Check for bookings (as lead, passenger 2/3, or secondary contact)
        const { data: leadBookings } = await supabase.from('bookings').select('id').eq('lead_passenger_id', id).limit(1);
        const { data: p2Bookings } = await supabase.from('bookings').select('id').eq('passenger_2_id', id).limit(1);
        const { data: p3Bookings } = await supabase.from('bookings').select('id').eq('passenger_3_id', id).limit(1);
        const { data: secBookings } = await supabase.from('bookings').select('id').eq('secondary_contact_id', id).limit(1);

        const hasBookings = (leadBookings?.length || 0) > 0 || (p2Bookings?.length || 0) > 0 || 
                           (p3Bookings?.length || 0) > 0 || (secBookings?.length || 0) > 0;

        if (hasBookings) {
          results.skipped++;
          const { data: cust } = await supabase.from('customers').select('first_name, last_name').eq('id', id).single();
          results.errors.push(`${cust?.first_name} ${cust?.last_name} has bookings`);
          continue;
        }

        // Clean up related records that reference this customer (non-booking FKs)
        // Keep xero_sync_log entries so deleted contacts aren't re-imported from Xero
        // await supabase.from('xero_sync_log').delete().eq('customer_id', id);
        await supabase.from('customer_access_tokens').delete().eq('customer_id', id);
        await supabase.from('customer_profile_updates').delete().eq('customer_id', id);
        await supabase.from('booking_travel_docs').delete().eq('customer_id', id);
        await supabase.from('booking_waivers').delete().eq('customer_id', id);

        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) {
          results.skipped++;
          results.errors.push(`${error.message}`);
        } else {
          results.deleted++;
        }
      }

      onProgress?.({ total, processed: total, deleted: results.deleted, skipped: results.skipped });
      return results;
    },
    onSuccess: (results) => {
      queryClient.removeQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      let description = `${results.deleted} contact(s) deleted.`;
      if (results.skipped > 0) {
        description += ` ${results.skipped} skipped (have bookings or errors).`;
      }
      
      toast({
        title: "Bulk Delete Complete",
        description,
        variant: results.skipped > 0 ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Delete Failed",
        description: error.message,
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
        const duplicateIds = contactsToDelete.map(c => c.id);
        
        console.log(`Merging ${contacts.length} contacts for ${mergedContact.first_name} ${mergedContact.last_name}`);
        
        // Reassign all booking references from duplicates to the primary contact
        for (const dupId of duplicateIds) {
          // Reassign lead_passenger_id
          await supabase.from('bookings').update({ lead_passenger_id: primaryContact.id }).eq('lead_passenger_id', dupId);
          // Reassign passenger_2_id
          await supabase.from('bookings').update({ passenger_2_id: primaryContact.id }).eq('passenger_2_id', dupId);
          // Reassign passenger_3_id
          await supabase.from('bookings').update({ passenger_3_id: primaryContact.id }).eq('passenger_3_id', dupId);
          // Reassign secondary_contact_id
          await supabase.from('bookings').update({ secondary_contact_id: primaryContact.id }).eq('secondary_contact_id', dupId);
          // Reassign booking_travel_docs
          await supabase.from('booking_travel_docs').update({ customer_id: primaryContact.id }).eq('customer_id', dupId);
          // Reassign booking_waivers
          await supabase.from('booking_waivers').update({ customer_id: primaryContact.id }).eq('customer_id', dupId);
          // Delete access tokens for duplicate (can't reassign)
          await supabase.from('customer_access_tokens').delete().eq('customer_id', dupId);
          // Delete profile updates for duplicate
          await supabase.from('customer_profile_updates').delete().eq('customer_id', dupId);
          // Delete xero sync log entries for duplicate to avoid FK constraint on delete
          await supabase.from('xero_sync_log').delete().eq('customer_id', dupId);
        }

        // Delete the duplicate contacts
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
        
        // Update the primary contact with merged data
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
      queryClient.invalidateQueries({ queryKey: ['all-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ids-with-bookings'] });
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

// Delete duplicate contacts (keep primary, delete the rest without merging data)
export const useDeleteDuplicateContacts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (duplicateGroups: DuplicateGroup[]) => {
      let totalDeleted = 0;
      let totalSkipped = 0;

      for (const group of duplicateGroups) {
        const { contacts } = group;
        const primaryContact = contacts[0];
        const contactsToDelete = contacts.slice(1);

        console.log(`Deleting ${contactsToDelete.length} duplicates for ${primaryContact.first_name} ${primaryContact.last_name}, keeping primary`);

        for (const dup of contactsToDelete) {
          // Check if this duplicate has bookings
          const { data: leadBookings } = await supabase.from('bookings').select('id').eq('lead_passenger_id', dup.id).limit(1);
          const { data: p2Bookings } = await supabase.from('bookings').select('id').eq('passenger_2_id', dup.id).limit(1);
          const { data: p3Bookings } = await supabase.from('bookings').select('id').eq('passenger_3_id', dup.id).limit(1);
          const { data: secBookings } = await supabase.from('bookings').select('id').eq('secondary_contact_id', dup.id).limit(1);

          const hasBookings = (leadBookings?.length || 0) > 0 || (p2Bookings?.length || 0) > 0 ||
                             (p3Bookings?.length || 0) > 0 || (secBookings?.length || 0) > 0;

          if (hasBookings) {
            console.log(`Skipping ${dup.first_name} ${dup.last_name} - has bookings`);
            totalSkipped++;
            continue;
          }

          // Clean up related records
          await supabase.from('customer_access_tokens').delete().eq('customer_id', dup.id);
          await supabase.from('customer_profile_updates').delete().eq('customer_id', dup.id);
          await supabase.from('booking_travel_docs').delete().eq('customer_id', dup.id);
          await supabase.from('booking_waivers').delete().eq('customer_id', dup.id);
          // Keep xero_sync_log to prevent re-import

          const { error } = await supabase.from('customers').delete().eq('id', dup.id);
          if (error) {
            console.error('Error deleting duplicate:', error);
            totalSkipped++;
          } else {
            totalDeleted++;
          }
        }
      }

      return { groupsProcessed: duplicateGroups.length, contactsDeleted: totalDeleted, contactsSkipped: totalSkipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      let desc = `Deleted ${result.contactsDeleted} duplicate contacts from ${result.groupsProcessed} groups.`;
      if (result.contactsSkipped > 0) {
        desc += ` ${result.contactsSkipped} skipped (have bookings).`;
      }
      toast({
        title: "Duplicates Deleted",
        description: desc,
        variant: result.contactsSkipped > 0 ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Duplicates",
        description: error.message || "Failed to delete duplicate contacts.",
        variant: "destructive",
      });
    },
  });
};

// Delete specific individual contacts by ID (for selecting specific duplicates to remove)
export const useDeleteSelectedContacts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contactIds: string[]) => {
      let totalDeleted = 0;
      let totalSkipped = 0;

      for (const contactId of contactIds) {
        // Check if this contact has bookings
        const [leadRes, p2Res, p3Res, secRes] = await Promise.all([
          supabase.from('bookings').select('id').eq('lead_passenger_id', contactId).limit(1),
          supabase.from('bookings').select('id').eq('passenger_2_id', contactId).limit(1),
          supabase.from('bookings').select('id').eq('passenger_3_id', contactId).limit(1),
          supabase.from('bookings').select('id').eq('secondary_contact_id', contactId).limit(1),
        ]);

        const hasBookings = (leadRes.data?.length || 0) > 0 || (p2Res.data?.length || 0) > 0 ||
                           (p3Res.data?.length || 0) > 0 || (secRes.data?.length || 0) > 0;

        if (hasBookings) {
          totalSkipped++;
          continue;
        }

        // Clean up related records
        await supabase.from('xero_sync_log').delete().eq('customer_id', contactId);
        await supabase.from('customer_access_tokens').delete().eq('customer_id', contactId);
        await supabase.from('customer_profile_updates').delete().eq('customer_id', contactId);
        await supabase.from('booking_travel_docs').update({ customer_id: null }).eq('customer_id', contactId);
        await supabase.from('booking_waivers').update({ customer_id: null }).eq('customer_id', contactId);

        const { error } = await supabase.from('customers').delete().eq('id', contactId);
        if (error) {
          console.error('Error deleting contact:', error);
          totalSkipped++;
        } else {
          totalDeleted++;
        }
      }

      return { contactsDeleted: totalDeleted, contactsSkipped: totalSkipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['all-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ids-with-bookings'] });
      let desc = `Deleted ${result.contactsDeleted} contacts.`;
      if (result.contactsSkipped > 0) {
        desc += ` ${result.contactsSkipped} skipped (have bookings).`;
      }
      toast({
        title: "Contacts Deleted",
        description: desc,
        variant: result.contactsSkipped > 0 ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Contacts",
        description: error.message || "Failed to delete contacts.",
        variant: "destructive",
      });
    },
  });
};
