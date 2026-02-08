import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, AlertCircle, Clock, Shield, FileText, User } from "lucide-react";
import { toast } from "sonner";

interface PassengerInfo {
  slot: number;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  has_email: boolean;
  is_token_owner: boolean;
}

interface SignedSlot {
  slot: number;
  signed_name: string;
  signed_at: string;
}

interface SignatureData {
  slot: number;
  customer_id: string | null;
  signed_name: string;
  agreed: boolean;
}

export default function SignWaiver() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customer, setCustomer] = useState<{ id: string; first_name: string; last_name: string } | null>(null);
  const [tour, setTour] = useState<{ name: string; start_date: string; end_date: string } | null>(null);
  const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
  const [editableSlots, setEditableSlots] = useState<number[]>([]);
  const [signedSlots, setSignedSlots] = useState<SignedSlot[]>([]);
  const [waiverText, setWaiverText] = useState("");
  const [waiverVersion, setWaiverVersion] = useState(1);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);

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
      const { data, error: fnError } = await supabase.functions.invoke("validate-waiver-token", {
        body: { token },
      });

      if (fnError || !data?.valid) {
        setError(data?.error || "This link is invalid or has expired");
        setLoading(false);
        return;
      }

      setCustomer(data.customer);
      setTour(data.tour);
      setPassengers(data.passengers);
      setEditableSlots(data.editableSlots);
      setSignedSlots(data.signedSlots || []);
      setExpiresAt(data.expiresAt);
      setWaiverVersion(data.waiverVersion);

      // Parse waiver text - handle JSON-escaped strings
      let parsedText = data.waiverText || "";
      if (typeof parsedText === "string") {
        try {
          const parsed = JSON.parse(parsedText);
          if (typeof parsed === "string") parsedText = parsed;
        } catch {
          // already a plain string
        }
      }
      setWaiverText(parsedText);

      // Initialize signatures for editable slots that haven't been signed yet
      const alreadySignedSlots = (data.signedSlots || []).map((s: SignedSlot) => s.slot);
      const unsignedEditableSlots = data.editableSlots.filter(
        (s: number) => !alreadySignedSlots.includes(s)
      );

      const initialSignatures: SignatureData[] = unsignedEditableSlots.map((slot: number) => {
        const passenger = data.passengers.find((p: PassengerInfo) => p.slot === slot);
        return {
          slot,
          customer_id: passenger?.customer_id || null,
          signed_name: "",
          agreed: false,
        };
      });
      setSignatures(initialSignatures);
      setLoading(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("Unable to validate your link. Please try again later.");
      setLoading(false);
    }
  };

  const handleSignatureChange = (slot: number, field: keyof SignatureData, value: string | boolean) => {
    setSignatures(prev =>
      prev.map(s => (s.slot === slot ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Validate all signatures
    const validSignatures = signatures.filter(s => s.agreed && s.signed_name.trim());
    if (validSignatures.length === 0) {
      toast.error("Please agree to the terms and type your full name for each passenger");
      return;
    }

    const incompleteSignatures = signatures.filter(s => !s.agreed || !s.signed_name.trim());
    if (incompleteSignatures.length > 0) {
      toast.error("Please complete all waiver signatures before submitting");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-waiver", {
        body: {
          token,
          signatures: validSignatures.map(s => ({
            slot: s.slot,
            customer_id: s.customer_id,
            signed_name: s.signed_name,
          })),
        },
      });

      if (fnError || data?.error) {
        toast.error(data?.error || "Failed to submit waiver");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Waiver signed successfully!");
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

  const getPassengerLabel = (slot: number) => {
    return slot === 1 ? "Lead Passenger" : `Passenger ${slot}`;
  };

  // Render waiver text with proper formatting
  const renderWaiverText = (text: string) => {
    const lines = text.split("\\n").join("\n").split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      // Detect section headers (numbered items like "1. Release of Liability:")
      if (/^\d+\.\s+/.test(trimmed) && trimmed.endsWith(":")) {
        return (
          <h4 key={i} className="font-semibold text-base mt-4 mb-1">
            {trimmed}
          </h4>
        );
      }
      // Detect the "Acceptance of Terms:" header
      if (trimmed === "Acceptance of Terms:") {
        return (
          <h4 key={i} className="font-semibold text-base mt-4 mb-1">
            {trimmed}
          </h4>
        );
      }
      return (
        <p key={i} className="text-sm leading-relaxed mb-2">
          {trimmed}
        </p>
      );
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
              Please contact Australian Racing Tours if you need to complete the waiver form.
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
            <CardTitle>Waiver Signed Successfully!</CardTitle>
            <CardDescription>
              Your waiver has been recorded. Thank you for completing the form.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-blue-700">
                Your digital signature has been securely stored along with the date, time, and IP address for legal records.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeRemaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

  // Check if all editable slots are already signed
  const alreadySignedSlotNumbers = signedSlots.map(s => s.slot);
  const allSigned = editableSlots.every(s => alreadySignedSlotNumbers.includes(s));

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
              <CardTitle className="text-2xl text-white">Tour Waiver Form</CardTitle>
            </div>
            <CardDescription className="text-center text-white/80 mt-2">
              Hi {customer?.first_name}! Please review and sign the waiver for your tour.
            </CardDescription>
            {hoursRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                <Clock className="h-4 w-4" />
                <span>This link expires in {hoursRemaining} hours</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Tour Information */}
            {tour && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">{tour.name}</h3>
                </div>
                <p className="text-sm text-green-700">
                  {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                </p>
              </div>
            )}

            {/* Already signed slots */}
            {signedSlots.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">Already Signed</h3>
                {signedSlots.map(s => {
                  const passenger = passengers.find(p => p.slot === s.slot);
                  return (
                    <div key={s.slot} className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        {getPassengerLabel(s.slot)}: {passenger?.first_name} {passenger?.last_name} — Signed by "{s.signed_name}" on{" "}
                        {new Date(s.signed_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {allSigned ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Waivers Signed</h3>
                <p className="text-muted-foreground">
                  All passengers on this booking have already signed the waiver.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Waiver Terms */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Waiver & Release Form
                  </h3>
                  <ScrollArea className="h-[400px] border rounded-lg p-4 bg-white">
                    <div className="pr-4">{renderWaiverText(waiverText)}</div>
                  </ScrollArea>
                </div>

                {/* Signature sections per passenger */}
                {signatures.map(sig => {
                  const passenger = passengers.find(p => p.slot === sig.slot);
                  if (!passenger) return null;

                  return (
                    <div
                      key={sig.slot}
                      className="mt-6 space-y-4 p-4 rounded-lg border bg-white"
                    >
                      <div className="flex items-center gap-2 border-b pb-2">
                        <User className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {getPassengerLabel(sig.slot)}: {passenger.first_name} {passenger.last_name}
                        </h3>
                        {passenger.is_token_owner && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`agree_${sig.slot}`}
                          checked={sig.agreed}
                          onCheckedChange={(checked) =>
                            handleSignatureChange(sig.slot, "agreed", checked === true)
                          }
                          className="mt-1"
                        />
                        <Label
                          htmlFor={`agree_${sig.slot}`}
                          className="text-sm leading-relaxed cursor-pointer"
                        >
                          I have carefully read and understood the terms of this waiver and release
                          form. I voluntarily agree to release, indemnify, and hold harmless the
                          Company from any and all claims, liabilities, actions, or expenses
                          (including legal fees) arising from my participation in the tour.
                        </Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`name_${sig.slot}`} className="font-medium">
                          Type your full legal name as your digital signature *
                        </Label>
                        <Input
                          id={`name_${sig.slot}`}
                          value={sig.signed_name}
                          onChange={(e) =>
                            handleSignatureChange(sig.slot, "signed_name", e.target.value)
                          }
                          placeholder={`${passenger.first_name} ${passenger.last_name}`}
                          required
                          className="text-lg font-medium italic"
                        />
                        <p className="text-xs text-muted-foreground">
                          By typing your name above, you are providing your digital signature
                          which is legally binding.
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Non-editable passengers info */}
                {passengers.filter(p => !editableSlots.includes(p.slot) && !alreadySignedSlotNumbers.includes(p.slot)).length > 0 && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      The following passengers have their own email and will receive a separate waiver link:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {passengers
                        .filter(p => !editableSlots.includes(p.slot) && !alreadySignedSlotNumbers.includes(p.slot))
                        .map(p => (
                          <li key={p.slot} className="text-sm text-amber-700">
                            • {p.first_name} {p.last_name} ({p.email})
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    type="submit"
                    disabled={submitting || signatures.some(s => !s.agreed || !s.signed_name.trim())}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow font-semibold px-8"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Sign & Submit Waiver"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
