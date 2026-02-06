import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock, Shield, Plane, User } from "lucide-react";
import { toast } from "sonner";

interface PassengerInfo {
  slot: number;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  has_email: boolean;
  is_token_owner: boolean;
  travel_docs: {
    passport_first_name: string | null;
    passport_middle_name: string | null;
    passport_surname: string | null;
    name_as_per_passport: string | null;
    passport_number: string | null;
    passport_expiry_date: string | null;
    passport_country: string | null;
    nationality: string | null;
    date_of_birth: string | null;
  } | null;
}

interface CustomerData {
  id: string;
  first_name: string;
  last_name: string;
}

interface TourData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface PassengerFormData {
  slot: number;
  customer_id: string | null;
  passport_first_name: string;
  passport_middle_name: string;
  passport_surname: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_country: string;
  nationality: string;
  date_of_birth: string;
}

export default function UpdateTravelDocs() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [tour, setTour] = useState<TourData | null>(null);
  const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
  const [editableSlots, setEditableSlots] = useState<number[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [formData, setFormData] = useState<PassengerFormData[]>([]);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("validate-travel-docs-token", {
        body: { token },
      });

      if (error || !data?.valid) {
        setError(data?.error || "This link is invalid or has expired");
        setLoading(false);
        return;
      }

      setCustomer(data.customer);
      setTour(data.tour);
      setPassengers(data.passengers);
      setEditableSlots(data.editableSlots);
      setExpiresAt(data.expiresAt);
      
      // Initialize form data for each passenger
      const initialFormData: PassengerFormData[] = data.passengers.map((p: PassengerInfo) => ({
        slot: p.slot,
        customer_id: p.customer_id,
        passport_first_name: p.travel_docs?.passport_first_name || p.first_name || "",
        passport_middle_name: p.travel_docs?.passport_middle_name || "",
        passport_surname: p.travel_docs?.passport_surname || p.last_name || "",
        passport_number: p.travel_docs?.passport_number || "",
        passport_expiry_date: p.travel_docs?.passport_expiry_date || "",
        passport_country: p.travel_docs?.passport_country || "",
        nationality: p.travel_docs?.nationality || "",
        date_of_birth: p.travel_docs?.date_of_birth || "",
      }));
      setFormData(initialFormData);
      
      setLoading(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("Unable to validate your link. Please try again later.");
      setLoading(false);
    }
  };

  const handleInputChange = (slot: number, field: string, value: string) => {
    setFormData((prev) => 
      prev.map((p) => 
        p.slot === slot ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Only submit editable passengers
    const passengersToSubmit = formData.filter(p => editableSlots.includes(p.slot));

    if (passengersToSubmit.length === 0) {
      toast.error("No passengers to update");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-travel-docs", {
        body: { 
          token, 
          passengers: passengersToSubmit.map(p => ({
            slot: p.slot,
            customer_id: p.customer_id,
            passport_first_name: p.passport_first_name || null,
            passport_middle_name: p.passport_middle_name || null,
            passport_surname: p.passport_surname || null,
            passport_number: p.passport_number || null,
            passport_expiry_date: p.passport_expiry_date || null,
            passport_country: p.passport_country || null,
            nationality: p.nationality || null,
            date_of_birth: p.date_of_birth || null,
          }))
        },
      });

      if (error) {
        toast.error(data?.error || "Failed to update travel documents");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Travel documents updated successfully!");
    } catch (err: any) {
      console.error("Update error:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getPassengerLabel = (slot: number, passenger: PassengerInfo) => {
    if (slot === 1) return "Lead Passenger";
    return `Passenger ${slot}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Link Invalid or Expired</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please contact Australian Racing Tours if you need to submit your travel documents.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle>Travel Documents Submitted!</CardTitle>
            <CardDescription>
              Travel documents have been saved successfully. A confirmation email has been sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-blue-700">
                Passport details are stored securely and will be automatically deleted 30 days after the tour ends.
              </p>
            </div>
            <Button onClick={() => setSuccess(false)} variant="outline">
              Make More Changes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeRemaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden">
          <CardHeader className="bg-brand-navy text-white p-6">
            <div className="flex items-center justify-center gap-4">
              <img 
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
                alt="Australian Racing Tours" 
                className="h-12"
              />
              <CardTitle className="text-2xl text-white">Travel Documents</CardTitle>
            </div>
            <CardDescription className="text-center text-white/80 mt-2">
              Hi {customer?.first_name}! Please provide passport details for your booking.
            </CardDescription>
            {hoursRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                <Clock className="h-4 w-4" />
                <span>This link expires in {hoursRemaining} hours</span>
              </div>
            )}
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {/* Tour Information */}
              {tour && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">{tour.name}</h3>
                  </div>
                  <p className="text-sm text-green-700">
                    {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                  </p>
                </div>
              )}

              {/* Info about what they can edit */}
              {passengers.length > 1 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    {editableSlots.length === passengers.length ? (
                      <>You can update travel documents for all {passengers.length} passengers on this booking.</>
                    ) : (
                      <>
                        You can update your own details
                        {editableSlots.length > 1 && " and any passengers without email addresses"}.
                        Other passengers with email addresses will receive their own link.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Passenger Forms */}
              {passengers.map((passenger, index) => {
                const paxFormData = formData.find(f => f.slot === passenger.slot);
                const isEditable = editableSlots.includes(passenger.slot);
                
                if (!paxFormData) return null;

                return (
                  <div 
                    key={passenger.slot} 
                    className={`space-y-4 p-4 rounded-lg border ${
                      isEditable ? 'bg-white border-border' : 'bg-muted/50 border-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 border-b pb-2">
                      <User className={`h-5 w-5 ${isEditable ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h3 className="font-semibold text-lg">
                        {getPassengerLabel(passenger.slot, passenger)}: {passenger.first_name} {passenger.last_name}
                      </h3>
                      {passenger.is_token_owner && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>
                      )}
                      {!isEditable && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded ml-auto">
                          Will receive their own link
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`firstname_${passenger.slot}`}>First Name (as per Passport) *</Label>
                        <Input
                          id={`firstname_${passenger.slot}`}
                          value={paxFormData.passport_first_name}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_first_name", e.target.value)}
                          placeholder="First name"
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`middlename_${passenger.slot}`}>Middle Name</Label>
                        <Input
                          id={`middlename_${passenger.slot}`}
                          value={paxFormData.passport_middle_name}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_middle_name", e.target.value)}
                          placeholder="Middle name (if applicable)"
                          disabled={!isEditable}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`surname_${passenger.slot}`}>Surname (as per Passport) *</Label>
                        <Input
                          id={`surname_${passenger.slot}`}
                          value={paxFormData.passport_surname}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_surname", e.target.value)}
                          placeholder="Surname/Family name"
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor={`passport_${passenger.slot}`}>Passport Number *</Label>
                        <Input
                          id={`passport_${passenger.slot}`}
                          value={paxFormData.passport_number}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_number", e.target.value)}
                          placeholder="e.g., PA1234567"
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`country_${passenger.slot}`}>Country of Issue *</Label>
                        <Input
                          id={`country_${passenger.slot}`}
                          value={paxFormData.passport_country}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_country", e.target.value)}
                          placeholder="e.g., Australia"
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`expiry_${passenger.slot}`}>Expiry Date *</Label>
                        <Input
                          id={`expiry_${passenger.slot}`}
                          type="date"
                          value={paxFormData.passport_expiry_date}
                          onChange={(e) => handleInputChange(passenger.slot, "passport_expiry_date", e.target.value)}
                          required={isEditable}
                          disabled={!isEditable}
                        />
                        <p className="text-xs text-muted-foreground">
                          Most countries require at least 6 months validity
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`nationality_${passenger.slot}`}>Nationality *</Label>
                        <Input
                          id={`nationality_${passenger.slot}`}
                          value={paxFormData.nationality}
                          onChange={(e) => handleInputChange(passenger.slot, "nationality", e.target.value)}
                          placeholder="e.g., Australian"
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`dob_${passenger.slot}`}>Date of Birth *</Label>
                        <Input
                          id={`dob_${passenger.slot}`}
                          type="date"
                          value={paxFormData.date_of_birth}
                          onChange={(e) => handleInputChange(passenger.slot, "date_of_birth", e.target.value)}
                          required={isEditable}
                          disabled={!isEditable}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Privacy Notice */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Privacy & Security</p>
                    <p>
                      Passport details are encrypted and stored securely. They will be 
                      automatically deleted from our systems 30 days after the tour ends.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow" 
                  size="lg" 
                  disabled={submitting || editableSlots.length === 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Submit Travel Documents${passengers.length > 1 ? ` (${editableSlots.length} passenger${editableSlots.length > 1 ? 's' : ''})` : ''}`
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          © Australian Racing Tours. Your information is kept secure and confidential.
        </p>
      </div>
    </div>
  );
}
