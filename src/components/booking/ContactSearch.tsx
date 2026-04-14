
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  onContactSelect: (contact: any) => void;
  selectedContactId: string;
  placeholder?: string;
  required?: boolean;
  label?: string;
}

export const ContactSearch = ({ 
  value, 
  onValueChange, 
  onContactSelect, 
  selectedContactId,
  placeholder = "Start typing name to search existing contacts...",
  required = true,
  label = "Lead Passenger Name"
}: ContactSearchProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => setDebouncedSearch(value), 250);
    } else {
      setDebouncedSearch("");
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  // Server-side search query
  const { data: filteredContacts = [] } = useQuery({
    queryKey: ['contact-search', debouncedSearch],
    queryFn: async () => {
      const searchTerm = debouncedSearch.trim();
      if (searchTerm.length < 2) return [];

      const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      let query = supabase
        .from('customers')
        .select('*')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .limit(20);

      if (searchWords.length >= 2) {
        const firstWord = searchWords[0];
        const secondWord = searchWords.slice(1).join(' ');
        query = query.or(
          `and(first_name.ilike.%${firstWord}%,last_name.ilike.%${secondWord}%),` +
          `and(first_name.ilike.%${secondWord}%,last_name.ilike.%${firstWord}%),` +
          `and(preferred_name.ilike.%${firstWord}%,last_name.ilike.%${secondWord}%)`
        );
      } else {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,preferred_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error('Contact search error:', error);
        return [];
      }
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000,
  });

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
      <Label htmlFor="contactSearch">{label}</Label>
      <div className="relative">
        <Input
          id="contactSearch"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          required={required}
        />
        
        {shouldShowSuggestions && (
          <div className="absolute z-[100] w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredContacts.map((customer: any) => (
              <div
                key={customer.id}
                className="px-4 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleContactSelect(customer);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {customer.first_name} {customer.last_name}
                      {customer.preferred_name && (
                        <span className="text-muted-foreground ml-1">({customer.preferred_name})</span>
                      )}
                      {selectedContactId === customer.id && (
                        <Check className="inline ml-2 h-4 w-4 text-green-600" />
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
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
