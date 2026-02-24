import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, User, Phone, Mail, Heart, AlertCircle, Accessibility, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SendProfileUpdateButton } from "@/components/SendProfileUpdateButton";

interface PassengerContact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  preferred_name?: string | null;
  dietary_requirements?: string | null;
  medical_conditions?: string | null;
  accessibility_needs?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  notes?: string | null;
}

interface PassengerDetailsSectionProps {
  passenger: PassengerContact | null;
  passengerNumber: 2 | 3;
  fallbackName?: string | null;
  bookingId: string;
  isAgent?: boolean;
}

const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <span className="text-muted-foreground">{label}:</span>
        <span className="ml-1">{value}</span>
      </div>
    </div>
  );
};

export const PassengerDetailsSection = ({ 
  passenger, 
  passengerNumber, 
  fallbackName,
  bookingId,
  isAgent = false
}: PassengerDetailsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // If no passenger contact and no fallback name, don't render anything
  if (!passenger && !fallbackName) return null;

  const displayName = passenger 
    ? `${passenger.first_name} ${passenger.last_name}` 
    : fallbackName;

  const preferredName = passenger?.preferred_name;
  const hasDetails = passenger && (
    passenger.email || 
    passenger.phone || 
    passenger.dietary_requirements || 
    passenger.medical_conditions || 
    passenger.accessibility_needs ||
    passenger.emergency_contact_name ||
    passenger.notes
  );

  // Simple display if no linked contact or no details
  if (!passenger || !hasDetails) {
    return (
      <div className="flex items-center gap-2 py-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Passenger {passengerNumber}:</span>
        <span className="text-sm">{displayName}</span>
        {!passenger && fallbackName && (
          <span className="text-xs text-muted-foreground">(not linked to contact)</span>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between p-2 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Passenger {passengerNumber}:</span>
            <span className="text-sm">{displayName}</span>
            {preferredName && (
              <span className="text-xs text-muted-foreground">({preferredName})</span>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pb-3 space-y-3">
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <InfoItem icon={Mail} label="Email" value={passenger.email} />
            <InfoItem icon={Phone} label="Phone" value={passenger.phone} />
          </div>

          {/* Dietary & Medical */}
          {(passenger.dietary_requirements || passenger.medical_conditions || passenger.accessibility_needs) && (
            <div className="pt-2 border-t space-y-2">
              <InfoItem icon={Heart} label="Dietary" value={passenger.dietary_requirements} />
              <InfoItem icon={AlertCircle} label="Medical" value={passenger.medical_conditions} />
              <InfoItem icon={Accessibility} label="Accessibility" value={passenger.accessibility_needs} />
            </div>
          )}

          {/* Contact Notes */}
          {passenger.notes && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Contact Notes:</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{passenger.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {passenger.emergency_contact_name && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Emergency Contact:</span>
                  <span className="ml-1">
                    {passenger.emergency_contact_name}
                    {passenger.emergency_contact_relationship && ` (${passenger.emergency_contact_relationship})`}
                    {passenger.emergency_contact_phone && ` - ${passenger.emergency_contact_phone}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t flex flex-wrap items-center gap-2">
            <Link 
              to={`/contacts/${passenger.id}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View Contact
              <ExternalLink className="h-3 w-3" />
            </Link>
            {!isAgent && passenger.email && (
              <SendProfileUpdateButton
                customerId={passenger.id}
                customerName={`${passenger.first_name} ${passenger.last_name}`}
                customerEmail={passenger.email}
                bookingId={bookingId}
                size="sm"
              />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
