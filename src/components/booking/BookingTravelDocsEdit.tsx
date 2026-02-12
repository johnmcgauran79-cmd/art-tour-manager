import { useState, useEffect } from "react";
import { useBookingTravelDocs, BookingTravelDoc } from "@/hooks/useBookingTravelDocs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Save, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PassengerInfo {
  first_name: string;
  last_name: string;
  id?: string;
}

interface BookingTravelDocsEditProps {
  bookingId: string;
  passengerCount: number;
  leadPassenger?: PassengerInfo | null;
  passenger2?: PassengerInfo | null;
  passenger3?: PassengerInfo | null;
}

interface PassengerDocForm {
  passport_first_name: string;
  passport_middle_name: string;
  passport_surname: string;
  date_of_birth: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_country: string;
  nationality: string;
}

const emptyForm: PassengerDocForm = {
  passport_first_name: '',
  passport_middle_name: '',
  passport_surname: '',
  date_of_birth: '',
  passport_number: '',
  passport_expiry_date: '',
  passport_country: '',
  nationality: '',
};

export const BookingTravelDocsEdit = ({
  bookingId,
  passengerCount,
  leadPassenger,
  passenger2,
  passenger3,
}: BookingTravelDocsEditProps) => {
  const { data: travelDocs = [], isLoading, refetch } = useBookingTravelDocs(bookingId);
  const [forms, setForms] = useState<Record<number, PassengerDocForm>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoading && !initialized) {
      const docsMap = new Map(travelDocs.map(doc => [doc.passenger_slot, doc]));
      const newForms: Record<number, PassengerDocForm> = {};
      
      for (let slot = 1; slot <= passengerCount; slot++) {
        const doc = docsMap.get(slot);
        newForms[slot] = {
          passport_first_name: doc?.passport_first_name || '',
          passport_middle_name: doc?.passport_middle_name || '',
          passport_surname: doc?.passport_surname || '',
          date_of_birth: doc?.date_of_birth || '',
          passport_number: doc?.passport_number || '',
          passport_expiry_date: doc?.passport_expiry_date || '',
          passport_country: doc?.passport_country || '',
          nationality: doc?.nationality || '',
        };
      }
      
      setForms(newForms);
      setInitialized(true);
    }
  }, [isLoading, travelDocs, passengerCount, initialized]);

  const getPassengerName = (slot: number): string => {
    switch (slot) {
      case 1:
        return leadPassenger ? `${leadPassenger.first_name} ${leadPassenger.last_name}` : 'Lead Passenger';
      case 2:
        return passenger2 ? `${passenger2.first_name} ${passenger2.last_name}` : 'Passenger 2';
      case 3:
        return passenger3 ? `${passenger3.first_name} ${passenger3.last_name}` : 'Passenger 3';
      default:
        return `Passenger ${slot}`;
    }
  };

  const getPassengerLabel = (slot: number): string => {
    switch (slot) {
      case 1: return 'Lead';
      case 2: return 'Pax 2';
      case 3: return 'Pax 3';
      default: return `Pax ${slot}`;
    }
  };

  const getCustomerId = (slot: number): string | null => {
    switch (slot) {
      case 1: return leadPassenger?.id || null;
      case 2: return passenger2?.id || null;
      case 3: return passenger3?.id || null;
      default: return null;
    }
  };

  const updateField = (slot: number, field: keyof PassengerDocForm, value: string) => {
    setForms(prev => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docsMap = new Map(travelDocs.map(doc => [doc.passenger_slot, doc]));
      
      for (let slot = 1; slot <= passengerCount; slot++) {
        const form = forms[slot];
        if (!form) continue;
        
        const existingDoc = docsMap.get(slot);
        const customerId = getCustomerId(slot);
        
        const docData = {
          booking_id: bookingId,
          passenger_slot: slot,
          customer_id: customerId,
          passport_first_name: form.passport_first_name || null,
          passport_middle_name: form.passport_middle_name || null,
          passport_surname: form.passport_surname || null,
          date_of_birth: form.date_of_birth || null,
          passport_number: form.passport_number || null,
          passport_expiry_date: form.passport_expiry_date || null,
          passport_country: form.passport_country || null,
          nationality: form.nationality || null,
        };

        if (existingDoc) {
          const { error } = await supabase
            .from('booking_travel_docs')
            .update(docData)
            .eq('id', existingDoc.id);
          if (error) throw error;
        } else {
          // Only insert if there's actual data
          const hasData = Object.values(form).some(v => v && v.trim() !== '');
          if (hasData) {
            const { error } = await supabase
              .from('booking_travel_docs')
              .insert(docData);
            if (error) throw error;
          }
        }
      }

      toast.success("Passport details saved successfully");
      refetch();
    } catch (err: any) {
      console.error("Error saving travel docs:", err);
      toast.error("Failed to save passport details");
    }
    setSaving(false);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading passport details...</div>;
  }

  const expectedSlots = Array.from({ length: passengerCount }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Use this section to manually enter or edit passport details for passengers who have provided their information directly (e.g., by phone or in person).
        </AlertDescription>
      </Alert>

      {expectedSlots.map(slot => {
        const form = forms[slot] || emptyForm;
        const docsMap = new Map(travelDocs.map(doc => [doc.passenger_slot, doc]));
        const hasExisting = !!(docsMap.get(slot)?.passport_number || docsMap.get(slot)?.passport_first_name);
        
        return (
          <div key={slot} className="bg-card border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-medium">{getPassengerName(slot)}</h3>
              <Badge variant="outline">{getPassengerLabel(slot)}</Badge>
              {hasExisting ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: 'hsl(var(--chart-2))' }} />
              ) : (
                <AlertCircle className="h-4 w-4" style={{ color: 'hsl(var(--chart-4))' }} />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>First Name (Passport)</Label>
                <Input
                  value={form.passport_first_name}
                  onChange={(e) => updateField(slot, 'passport_first_name', e.target.value)}
                  placeholder="First name as per passport"
                />
              </div>
              <div>
                <Label>Middle Name (Passport)</Label>
                <Input
                  value={form.passport_middle_name}
                  onChange={(e) => updateField(slot, 'passport_middle_name', e.target.value)}
                  placeholder="Middle name as per passport"
                />
              </div>
              <div>
                <Label>Surname (Passport)</Label>
                <Input
                  value={form.passport_surname}
                  onChange={(e) => updateField(slot, 'passport_surname', e.target.value)}
                  placeholder="Surname as per passport"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => updateField(slot, 'date_of_birth', e.target.value)}
                />
              </div>
              <div>
                <Label>Passport Number</Label>
                <Input
                  value={form.passport_number}
                  onChange={(e) => updateField(slot, 'passport_number', e.target.value)}
                  placeholder="Passport number"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Passport Expiry Date</Label>
                <Input
                  type="date"
                  value={form.passport_expiry_date}
                  onChange={(e) => updateField(slot, 'passport_expiry_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Country of Issue</Label>
                <Input
                  value={form.passport_country}
                  onChange={(e) => updateField(slot, 'passport_country', e.target.value)}
                  placeholder="Country of issue"
                />
              </div>
              <div>
                <Label>Nationality</Label>
                <Input
                  value={form.nationality}
                  onChange={(e) => updateField(slot, 'nationality', e.target.value)}
                  placeholder="Nationality"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Passport Details'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Passport details are securely stored and automatically purged 30 days after the tour ends.
      </p>
    </div>
  );
};
