import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock, Shield, Plane } from "lucide-react";
import { toast } from "sonner";

interface CustomerData {
  id: string;
  first_name: string;
  last_name: string;
}

interface BookingData {
  id: string;
  passport_number: string | null;
  passport_expiry_date: string | null;
  passport_country: string | null;
  nationality: string | null;
  id_number: string | null;
}

interface TourData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export default function UpdateTravelDocs() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [tour, setTour] = useState<TourData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    passport_number: "",
    passport_expiry_date: "",
    passport_country: "",
    nationality: "",
    id_number: "",
  });

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
      setBooking(data.booking);
      setTour(data.tour);
      setExpiresAt(data.expiresAt);
      setFormData({
        passport_number: data.booking.passport_number || "",
        passport_expiry_date: data.booking.passport_expiry_date || "",
        passport_country: data.booking.passport_country || "",
        nationality: data.booking.nationality || "",
        id_number: data.booking.id_number || "",
      });
      setLoading(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("Unable to validate your link. Please try again later.");
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !booking) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-travel-docs", {
        body: { 
          token, 
          updates: {
            passport_number: formData.passport_number || null,
            passport_expiry_date: formData.passport_expiry_date || null,
            passport_country: formData.passport_country || null,
            nationality: formData.nationality || null,
            id_number: formData.id_number || null,
          }
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
              Your travel documents have been saved successfully. A confirmation email has been sent to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-blue-700">
                Your passport details are stored securely and will be automatically deleted 30 days after your tour ends.
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
      <div className="max-w-2xl mx-auto">
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
              Hi {customer?.first_name}! Please provide your passport details for your upcoming tour.
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

              {/* Passport Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Passport Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="passport_number">Passport Number *</Label>
                    <Input
                      id="passport_number"
                      value={formData.passport_number}
                      onChange={(e) => handleInputChange("passport_number", e.target.value)}
                      placeholder="e.g., PA1234567"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passport_country">Country of Issue *</Label>
                    <Input
                      id="passport_country"
                      value={formData.passport_country}
                      onChange={(e) => handleInputChange("passport_country", e.target.value)}
                      placeholder="e.g., Australia"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passport_expiry_date">Expiry Date *</Label>
                    <Input
                      id="passport_expiry_date"
                      type="date"
                      value={formData.passport_expiry_date}
                      onChange={(e) => handleInputChange("passport_expiry_date", e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Most countries require at least 6 months validity
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input
                      id="nationality"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange("nationality", e.target.value)}
                      placeholder="e.g., Australian"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Additional ID */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Additional Identification (Optional)</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="id_number">National ID / Driver's License Number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => handleInputChange("id_number", e.target.value)}
                    placeholder="Optional additional identification"
                  />
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Privacy & Security</p>
                    <p>
                      Your passport details are encrypted and stored securely. They will be 
                      automatically deleted from our systems 30 days after your tour ends.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow" 
                  size="lg" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Submit Travel Documents"
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
