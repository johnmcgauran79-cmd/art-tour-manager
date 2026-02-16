import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useAllCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface PassengerContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dietary_requirements: string | null;
  medical_conditions: string | null;
  accessibility_needs: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  preferred_name?: string | null;
}

interface PassengerContactSearchProps {
  label: string;
  selectedContact: PassengerContact | null;
  onContactSelect: (contact: PassengerContact | null) => void;
  fallbackName?: string;
  onFallbackNameChange?: (name: string) => void;
  showExpandedDetails?: boolean;
  required?: boolean;
  placeholder?: string;
}

export const PassengerContactSearch = ({
  label,
  selectedContact,
  onContactSelect,
  fallbackName = "",
  onFallbackNameChange,
  showExpandedDetails = true,
  required = false,
  placeholder = "Search for contact or enter name..."
}: PassengerContactSearchProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: customers } = useAllCustomers();
  const createCustomer = useCreateCustomer();
  const { toast } = useToast();

  const filteredContacts = customers?.filter(customer => {
    if (!searchValue || searchValue.length < 2) return false;
    const searchTerm = searchValue.toLowerCase();
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    const email = (customer.email || "").toLowerCase();
    return fullName.includes(searchTerm) || email.includes(searchTerm);
  }) || [];

  const shouldShowSuggestions = searchValue.length >= 2 && showSuggestions;

  const handleContactSelect = (customer: any) => {
    onContactSelect(customer);
    setSearchValue("");
    setShowSuggestions(false);
  };

  const handleClearContact = () => {
    onContactSelect(null);
    setSearchValue("");
  };

  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
    if (onFallbackNameChange) {
      onFallbackNameChange(newValue);
    }
    setShowSuggestions(newValue.length >= 2);
  };

  const handleAutoCreate = async () => {
    if (!searchValue.trim()) return;
    
    const parts = searchValue.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    
    if (!firstName) {
      toast({
        title: "Error",
        description: "Please enter at least a first name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const newContact = await createCustomer.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        preferred_name: null,
        email: null,
        phone: null,
        city: null,
        state: null,
        country: null,
        spouse_name: null,
        dietary_requirements: null,
        notes: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relationship: null,
        emergency_contact_email: null,
        medical_conditions: null,
        accessibility_needs: null,
        avatar_url: null,
      });
      
      onContactSelect(newContact as PassengerContact);
      setSearchValue("");
      setShowSuggestions(false);
      
      toast({
        title: "Contact created",
        description: `${firstName} ${lastName} has been added as a contact`,
      });
    } catch (error) {
      console.error("Error creating contact:", error);
      toast({
        title: "Error",
        description: "Failed to create contact",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const displayName = selectedContact
    ? `${selectedContact.first_name} ${selectedContact.last_name}${selectedContact.preferred_name ? ` (${selectedContact.preferred_name})` : ""}`
    : null;

  const hasDetails = selectedContact && (
    selectedContact.dietary_requirements ||
    selectedContact.medical_conditions ||
    selectedContact.accessibility_needs ||
    selectedContact.emergency_contact_name
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {selectedContact ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <div className="flex-1 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium">{displayName}</span>
              {selectedContact.email && (
                <span className="text-sm text-muted-foreground">({selectedContact.email})</span>
              )}
            </div>
            <Link 
              to={`/contacts/${selectedContact.id}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearContact}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showExpandedDetails && hasDetails && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="text-sm text-muted-foreground">
                    {isExpanded ? "Hide details" : "Show dietary & medical details"}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="p-3 border rounded-md bg-background space-y-3">
                  {selectedContact.dietary_requirements && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Dietary Requirements</span>
                      <p className="text-sm">{selectedContact.dietary_requirements}</p>
                    </div>
                  )}
                  {selectedContact.medical_conditions && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Medical Conditions</span>
                      <p className="text-sm">{selectedContact.medical_conditions}</p>
                    </div>
                  )}
                  {selectedContact.accessibility_needs && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Accessibility Needs</span>
                      <p className="text-sm">{selectedContact.accessibility_needs}</p>
                    </div>
                  )}
                  {selectedContact.emergency_contact_name && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Emergency Contact</span>
                      <p className="text-sm">
                        {selectedContact.emergency_contact_name}
                        {selectedContact.emergency_contact_phone && ` - ${selectedContact.emergency_contact_phone}`}
                        {selectedContact.emergency_contact_relationship && ` (${selectedContact.emergency_contact_relationship})`}
                      </p>
                    </div>
                  )}
                  <Link 
                    to={`/contacts/${selectedContact.id}/edit`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Edit contact details
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      ) : (
        <div className="relative">
          <Input
            value={fallbackName || searchValue}
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
              {filteredContacts.length > 0 ? (
                filteredContacts.map((customer) => (
                  <div
                    key={customer.id}
                    className="px-4 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleContactSelect(customer);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {customer.first_name} {customer.last_name}
                        {customer.preferred_name && (
                          <span className="text-muted-foreground ml-1">({customer.preferred_name})</span>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {customer.email} {customer.phone && `• ${customer.phone}`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-muted-foreground text-sm">
                  No matching contacts found
                </div>
              )}
              
              {/* Auto-create option */}
              {searchValue.trim() && (
                <div
                  className="px-4 py-2 hover:bg-accent cursor-pointer border-t border-border transition-colors flex items-center gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAutoCreate();
                  }}
                >
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span className="text-primary font-medium">
                    {isCreating ? "Creating..." : `Create "${searchValue.trim()}" as new contact`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
