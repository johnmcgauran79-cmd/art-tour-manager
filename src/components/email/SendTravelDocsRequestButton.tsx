import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plane, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PassengerInfo {
  name: string;
  email: string | null;
  slotNumber?: number;
}

// Single customer mode (legacy support)
interface SingleCustomerProps {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  tourName: string;
  travelDocsRequired: boolean;
}

// Multi-passenger mode
interface MultiPassengerProps {
  bookingId: string;
  tourName: string;
  travelDocsRequired: boolean;
  leadPassenger?: PassengerInfo;
  passenger2?: PassengerInfo | null;
  passenger3?: PassengerInfo | null;
}

type SendTravelDocsRequestButtonProps = (SingleCustomerProps | MultiPassengerProps) & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

function isMultiPassengerMode(props: SendTravelDocsRequestButtonProps): props is MultiPassengerProps & { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "lg" | "icon"; } {
  return 'leadPassenger' in props;
}

interface PassengerWithStatus extends PassengerInfo {
  slotNumber: number;
  hasSubmitted: boolean;
}

export function SendTravelDocsRequestButton(props: SendTravelDocsRequestButtonProps) {
  const { bookingId, tourName, travelDocsRequired, variant = "outline", size = "sm" } = props;
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [passengersWithStatus, setPassengersWithStatus] = useState<PassengerWithStatus[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Determine mode and collect recipients
  let passengersWithEmail: PassengerInfo[] = [];

  if (isMultiPassengerMode(props)) {
    passengersWithEmail = [
      props.leadPassenger?.email ? { ...props.leadPassenger, slotNumber: 1 } : null,
      props.passenger2?.email ? { ...props.passenger2, slotNumber: 2 } : null,
      props.passenger3?.email ? { ...props.passenger3, slotNumber: 3 } : null,
    ].filter(Boolean) as PassengerInfo[];
  } else {
    if (props.customerEmail) {
      passengersWithEmail = [{ name: props.customerName, email: props.customerEmail, slotNumber: 1 }];
    }
  }

  // Fetch travel docs submission status when dialog opens
  useEffect(() => {
    if (!open || passengersWithEmail.length === 0) return;

    const fetchStatus = async () => {
      setLoadingStatus(true);
      try {
        const { data: docs } = await supabase
          .from("booking_travel_docs")
          .select("passenger_slot, passport_number, passport_first_name, passport_surname")
          .eq("booking_id", bookingId);

        const withStatus: PassengerWithStatus[] = passengersWithEmail.map(p => {
          const slot = p.slotNumber || 1;
          const doc = docs?.find(d => d.passenger_slot === slot);
          const hasSubmitted = !!(doc && (doc.passport_number || doc.passport_first_name || doc.passport_surname));
          return { ...p, slotNumber: slot, hasSubmitted };
        });

        setPassengersWithStatus(withStatus);
        // Default: select all who haven't submitted
        const defaultSelected = new Set(withStatus.filter(p => !p.hasSubmitted).map(p => p.slotNumber));
        // If everyone has submitted, select all (user probably wants to resend)
        if (defaultSelected.size === 0) {
          setSelectedSlots(new Set(withStatus.map(p => p.slotNumber)));
        } else {
          setSelectedSlots(defaultSelected);
        }
      } catch (err) {
        console.error("Error fetching travel docs status:", err);
        // Fallback: select all
        const all = passengersWithEmail.map(p => ({ ...p, slotNumber: p.slotNumber || 1, hasSubmitted: false }));
        setPassengersWithStatus(all);
        setSelectedSlots(new Set(all.map(p => p.slotNumber)));
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [open, bookingId]);

  const toggleSlot = (slot: number) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedSlots.size === 0) {
      toast.error("Please select at least one passenger");
      return;
    }

    setSending(true);
    setOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-travel-docs-request", {
        body: { bookingId, passengerSlots: Array.from(selectedSlots) },
      });

      if (error) {
        console.error("Send error:", error);
        toast.error(data?.error || "Failed to send passport details request");
        setSending(false);
        return;
      }

      if (data.sentTo && data.sentTo.length > 0) {
        toast.success(`Passport details request sent to ${data.sentTo.length} passenger(s)`);
      } else if (data.success) {
        toast.success("Passport details request sent successfully");
      }
      
      if (data.failed && data.failed.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending passport details request:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSending(false);
  };

  if (!travelDocsRequired) {
    return null;
  }

  if (passengersWithEmail.length === 0) {
    return (
      <Button variant={variant} size={size} disabled title="No passengers have email addresses">
        <Plane className="h-4 w-4 mr-2" />
        Request Passport Details
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={sending}>
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plane className="h-4 w-4 mr-2" />
          )}
          {sending ? "Sending..." : "Request Passport Details"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Request Passport Details</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Select which passengers to send passport details requests to for <strong>{tourName}</strong>:
              </p>
              
              {loadingStatus ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking submission status...
                </div>
              ) : (
                <div className="space-y-2 mt-3">
                  {passengersWithStatus.map((p) => (
                    <label
                      key={p.slotNumber}
                      className="flex items-center gap-3 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedSlots.has(p.slotNumber)}
                        onCheckedChange={() => toggleSlot(p.slotNumber)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-sm text-muted-foreground ml-1">({p.email})</span>
                      </div>
                      {p.hasSubmitted ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          Submitted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 shrink-0">
                          Missing
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
              )}

              <p className="text-sm mt-3">
                Each selected passenger will receive an individual email with a secure link to submit their passport details.
              </p>
              <p className="text-sm text-muted-foreground">
                Links will expire in 7 days. Passport data is automatically purged 30 days after the tour ends.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={selectedSlots.size === 0}>
            Send to {selectedSlots.size} passenger{selectedSlots.size !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
