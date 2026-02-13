import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Clock, Bus, MapPin } from "lucide-react";
import { toast } from "sonner";

interface PickupOption {
  id: string;
  name: string;
  pickup_time: string | null;
  details: string | null;
}

export default function SelectPickup() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customer, setCustomer] = useState<{ first_name: string; last_name: string } | null>(null);
  const [tour, setTour] = useState<{ name: string; start_date: string; end_date: string } | null>(null);
  const [pickupOptions, setPickupOptions] = useState<PickupOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

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
      const { data, error: fnError } = await supabase.functions.invoke("validate-pickup-token", {
        body: { token },
      });

      if (fnError || !data?.valid) {
        setError(data?.error || "This link is invalid or has expired");
        setLoading(false);
        return;
      }

      setCustomer(data.customer);
      setTour(data.tour);
      setPickupOptions(data.pickupOptions);
      setExpiresAt(data.expiresAt);
      
      if (data.currentSelection) {
        setCurrentSelection(data.currentSelection);
        setSelectedOptionId(data.currentSelection);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("Unable to validate your link. Please try again later.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedOptionId) return;

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-pickup-selection", {
        body: { token, pickupOptionId: selectedOptionId },
      });

      if (fnError || data?.error) {
        toast.error(data?.error || "Failed to submit selection");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setCurrentSelection(selectedOptionId);
      toast.success("Pickup location selected successfully!");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("An error occurred. Please try again.");
    }
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }
    return time;
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
              Please contact Australian Racing Tours if you need to select a pickup location.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    const selectedOption = pickupOptions.find(o => o.id === selectedOptionId);
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle>Pickup Location Confirmed!</CardTitle>
            <CardDescription>
              Your pickup location has been recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {selectedOption && (
              <div className="bg-green-50 p-4 rounded-lg">
                <MapPin className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-green-800">{selectedOption.name}</p>
                {selectedOption.pickup_time && (
                  <p className="text-sm text-green-700">Pickup at {formatTime(selectedOption.pickup_time)}</p>
                )}
                {selectedOption.details && (
                  <p className="text-sm text-green-700 mt-1">{selectedOption.details}</p>
                )}
              </div>
            )}
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
              <CardTitle className="text-2xl text-white">Select Pickup Location</CardTitle>
            </div>
            <CardDescription className="text-center text-white/80 mt-2">
              Hi {customer?.first_name}! Please select your preferred pickup location for your tour.
            </CardDescription>
            {hoursRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                <Clock className="h-4 w-4" />
                <span>This link expires in {hoursRemaining} hours</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {tour && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bus className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">{tour.name}</h3>
                </div>
                <p className="text-sm text-green-700">
                  {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                </p>
              </div>
            )}

            {currentSelection && !success && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Current selection:</strong>{" "}
                  {pickupOptions.find(o => o.id === currentSelection)?.name || "Unknown"}
                  . You can change your selection below.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Available Pickup Locations
                </h3>

                <RadioGroup
                  value={selectedOptionId}
                  onValueChange={setSelectedOptionId}
                  className="space-y-3"
                >
                  {pickupOptions.map(option => (
                    <div
                      key={option.id}
                      className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors ${
                        selectedOptionId === option.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{option.name}</div>
                        {option.pickup_time && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Pickup time: {formatTime(option.pickup_time)}
                          </div>
                        )}
                        {option.details && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {option.details}
                          </div>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting || !selectedOptionId}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow font-semibold px-8"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Confirm Pickup Location"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
