import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/utils/phoneFormatter";

interface CustomerData {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dietary_requirements: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  medical_conditions: string | null;
  accessibility_needs: string | null;
}

export default function UpdateProfile() {
  const { token: tokenFromPath } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const token = tokenFromPath || searchParams.get("token") || undefined;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CustomerData>>({});

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
      const { data, error } = await supabase.functions.invoke("validate-profile-token", {
        body: { token },
      });

      if (error || !data?.valid) {
        setError(data?.error || "This link is invalid or has expired");
        setLoading(false);
        return;
      }

      setCustomer(data.customer);
      setExpiresAt(data.expiresAt);
      setFormData(data.customer);
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
    if (!token || !customer) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-customer-profile", {
        body: { 
          token, 
          updates: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            preferred_name: formData.preferred_name,
            email: formData.email,
            phone: formData.phone,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            dietary_requirements: formData.dietary_requirements,
            emergency_contact_name: formData.emergency_contact_name,
            emergency_contact_phone: formData.emergency_contact_phone,
            emergency_contact_relationship: formData.emergency_contact_relationship,
            medical_conditions: formData.medical_conditions,
            accessibility_needs: formData.accessibility_needs,
          }
        },
      });

      if (error) {
        toast.error(data?.error || "Failed to update profile");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Update error:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSubmitting(false);
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
              Please contact Australian Racing Tours if you need to update your profile.
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
            <CardTitle>Profile Updated!</CardTitle>
            <CardDescription>
              Your information has been saved successfully. A confirmation email has been sent to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You can close this page or make additional changes below.
            </p>
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
              <CardTitle className="text-2xl text-white">Update Your Profile</CardTitle>
            </div>
            <CardDescription className="text-center text-white/80 mt-2">
              Hi {customer?.first_name}! Please review and update your information below.
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
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name || ""}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Surname</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name || ""}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferred_name">Preferred Name</Label>
                    <Input
                      id="preferred_name"
                      value={formData.preferred_name || ""}
                      onChange={(e) => handleInputChange("preferred_name", e.target.value)}
                      placeholder="What would you like to be called?"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatPhoneForWhatsApp(e.target.value);
                        if (formatted && formatted !== e.target.value) {
                          handleInputChange("phone", formatted);
                        }
                      }}
                      placeholder="+61 412 345 678"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ""}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state || ""}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country || ""}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Emergency Contact</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name || ""}
                      onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                      placeholder="e.g., Jane Smith"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                    <Input
                      id="emergency_contact_phone"
                      type="tel"
                      value={formData.emergency_contact_phone || ""}
                      onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatPhoneForWhatsApp(e.target.value);
                        if (formatted && formatted !== e.target.value) {
                          handleInputChange("emergency_contact_phone", formatted);
                        }
                      }}
                      placeholder="+61 412 345 678"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                    <Input
                      id="emergency_contact_relationship"
                      value={formData.emergency_contact_relationship || ""}
                      onChange={(e) => handleInputChange("emergency_contact_relationship", e.target.value)}
                      placeholder="e.g., Spouse, Parent, Friend"
                    />
                  </div>
                </div>
              </div>

              {/* Health & Dietary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Health & Dietary Information</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
                    <Textarea
                      id="dietary_requirements"
                      value={formData.dietary_requirements || ""}
                      onChange={(e) => handleInputChange("dietary_requirements", e.target.value)}
                      placeholder="e.g., Vegetarian, Gluten-free, Allergies..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medical_conditions">Medical Conditions</Label>
                    <Textarea
                      id="medical_conditions"
                      value={formData.medical_conditions || ""}
                      onChange={(e) => handleInputChange("medical_conditions", e.target.value)}
                      placeholder="Any medical conditions we should be aware of..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessibility_needs">Accessibility Needs</Label>
                    <Textarea
                      id="accessibility_needs"
                      value={formData.accessibility_needs || ""}
                      onChange={(e) => handleInputChange("accessibility_needs", e.target.value)}
                      placeholder="Any accessibility requirements..."
                      rows={2}
                    />
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
                    "Save Changes"
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
