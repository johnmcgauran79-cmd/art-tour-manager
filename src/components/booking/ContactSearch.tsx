
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useAllCustomers } from "@/hooks/useCustomers";

interface ContactSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  onContactSelect: (contact: any) => void;
  selectedContactId: string;
  placeholder?: string;
}

export const ContactSearch = ({ 
  value, 
  onValueChange, 
  onContactSelect, 
  selectedContactId,
  placeholder = "Start typing name to search existing contacts..."
}: ContactSearchProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { data: customers } = useAllCustomers();

  const filteredContacts = customers?.filter(customer => {
    if (!value || value.length < 2) return false;
    const searchTerm = value.toLowerCase();
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(searchTerm);
  }) || [];

  const shouldShowSuggestions = value.length >= 2 && filteredContacts.length > 0 && showSuggestions;

  const handleContactSelect = (customer: any) => {
    onContactSelect(customer);
    setShowSuggestions(false);
  };

  const handleInputChange = (newValue: string) => {
    onValueChange(newValue);
    setShowSuggestions(newValue.length >= 2);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="leadPassenger">Lead Passenger Name</Label>
      <div className="relative">
        <Input
          id="leadPassenger"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          required
        />
        
        {shouldShowSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredContacts.map((customer) => (
              <div
                key={customer.id}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleContactSelect(customer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {customer.first_name} {customer.last_name}
                      {selectedContactId === customer.id && (
                        <Check className="inline ml-2 h-4 w-4 text-green-600" />
                      )}
                    </span>
                    <span className="text-sm text-gray-500">
                      {customer.email} {customer.phone && `• ${customer.phone}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
