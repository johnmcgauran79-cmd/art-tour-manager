
import { Customer } from "@/hooks/useCustomers";
import { formatAustralianMobile } from "@/hooks/useCustomers";
import { CSVContact } from "./csvParser";

export const findExistingCustomer = (contact: CSVContact, existingCustomers: Customer[] | undefined) => {
  if (!existingCustomers) return null;
  
  // First check by email if provided
  if (contact.email) {
    const emailMatch = existingCustomers.find(
      customer => customer.email?.toLowerCase() === contact.email?.toLowerCase()
    );
    if (emailMatch) return emailMatch;
  }
  
  // Then check by name
  return existingCustomers.find(
    customer => 
      customer.first_name.toLowerCase() === contact.first_name.toLowerCase() &&
      customer.last_name.toLowerCase() === contact.last_name.toLowerCase()
  );
};

export const prepareCustomerData = (contact: CSVContact) => {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email || null,
    phone: contact.phone ? formatAustralianMobile(contact.phone) || contact.phone : null,
    city: contact.city || null,
    state: contact.state || null,
    country: contact.country || null,
    spouse_name: contact.spouse_name || null,
    dietary_requirements: contact.dietary_requirements || null,
    notes: contact.notes || null,
    crm_id: null,
    last_synced_at: null,
  };
};

export const getFieldsToUpdate = (customerData: any, existingContact: Customer) => {
  return Object.keys(customerData).filter(key => {
    const newValue = customerData[key as keyof typeof customerData];
    const existingValue = existingContact[key as keyof typeof existingContact];
    
    // Only update if new value is not null/empty and different from existing
    if (newValue === null || newValue === '') return false;
    if (existingValue === newValue) return false;
    
    return true;
  });
};
