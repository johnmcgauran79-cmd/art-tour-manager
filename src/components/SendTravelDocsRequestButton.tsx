import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plane, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export function SendTravelDocsRequestButton(props: SendTravelDocsRequestButtonProps) {
  const { bookingId, tourName, travelDocsRequired, variant = "outline", size = "sm" } = props;
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  // Determine mode and collect recipients
  let passengersWithEmail: PassengerInfo[] = [];

  if (isMultiPassengerMode(props)) {
    // Multi-passenger mode
    passengersWithEmail = [
      props.leadPassenger?.email ? props.leadPassenger : null,
      props.passenger2?.email ? props.passenger2 : null,
      props.passenger3?.email ? props.passenger3 : null,
    ].filter(Boolean) as PassengerInfo[];
  } else {
    // Single customer mode (legacy)
    if (props.customerEmail) {
      passengersWithEmail = [{ name: props.customerName, email: props.customerEmail }];
    }
  }

  const handleSend = async () => {
    if (passengersWithEmail.length === 0) {
      toast.error("No passengers have email addresses");
      return;
    }

    setSending(true);
    setOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-travel-docs-request", {
        body: { bookingId },
      });

      if (error) {
        console.error("Send error:", error);
        toast.error(data?.error || "Failed to send travel documents request");
        setSending(false);
        return;
      }

      if (data.sentTo && data.sentTo.length > 0) {
        toast.success(`Travel documents request sent to ${data.sentTo.length} passenger(s)`);
      } else if (data.success) {
        toast.success("Travel documents request sent successfully");
      }
      
      if (data.failed && data.failed.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending travel docs request:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSending(false);
  };

  // Don't show if travel docs not required for this tour
  if (!travelDocsRequired) {
    return null;
  }

  if (passengersWithEmail.length === 0) {
    return (
      <Button variant={variant} size={size} disabled title="No passengers have email addresses">
        <Plane className="h-4 w-4 mr-2" />
        Request Travel Docs
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
          {sending ? "Sending..." : "Request Travel Docs"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Request Travel Documents</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will send {passengersWithEmail.length === 1 ? "an email" : "individual emails"} to {passengersWithEmail.length === 1 ? "the following passenger" : `${passengersWithEmail.length} passengers`} requesting
              their passport details for <strong>{tourName}</strong>:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {passengersWithEmail.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong> ({p.email})
                </li>
              ))}
            </ul>
            <p className="text-sm mt-3">
              Each link allows them to securely submit: passport name fields, passport number, country of issue, expiry
              date, nationality, and additional ID.
            </p>
            <p className="text-sm text-muted-foreground">
              Links will expire in 72 hours. Passport data is automatically purged 30 days after the tour ends.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend}>Send Request</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
