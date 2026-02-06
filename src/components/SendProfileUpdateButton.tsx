import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPen, Loader2 } from "lucide-react";
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

// Single customer mode (e.g., from contact page or passenger section)
interface SingleCustomerProps {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  bookingId?: string;
}

// Multi-passenger mode (e.g., from booking page)
interface MultiPassengerProps {
  bookingId: string;
  leadPassenger?: PassengerInfo;
  passenger2?: PassengerInfo | null;
  passenger3?: PassengerInfo | null;
}

type SendProfileUpdateButtonProps = (SingleCustomerProps | MultiPassengerProps) & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

function isSingleCustomerMode(props: SendProfileUpdateButtonProps): props is SingleCustomerProps & { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "lg" | "icon"; } {
  return 'customerId' in props;
}

export function SendProfileUpdateButton(props: SendProfileUpdateButtonProps) {
  const { variant = "outline", size = "sm" } = props;
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  // Determine mode and collect recipients
  let passengersWithEmail: PassengerInfo[] = [];
  let invokeBody: { customerId?: string; bookingId?: string } = {};

  if (isSingleCustomerMode(props)) {
    // Single customer mode
    if (props.customerEmail) {
      passengersWithEmail = [{ name: props.customerName, email: props.customerEmail }];
    }
    invokeBody = { customerId: props.customerId, bookingId: props.bookingId };
  } else {
    // Multi-passenger mode
    passengersWithEmail = [
      props.leadPassenger?.email ? props.leadPassenger : null,
      props.passenger2?.email ? props.passenger2 : null,
      props.passenger3?.email ? props.passenger3 : null,
    ].filter(Boolean) as PassengerInfo[];
    invokeBody = { bookingId: props.bookingId };
  }

  const handleSend = async () => {
    if (passengersWithEmail.length === 0) {
      toast.error("No passengers have email addresses");
      return;
    }

    setSending(true);
    setOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-profile-update-request", {
        body: invokeBody,
      });

      if (error) {
        console.error("Send error:", error);
        toast.error(data?.error || "Failed to send profile update request");
        setSending(false);
        return;
      }

      if (data.sentTo && data.sentTo.length > 0) {
        toast.success(`Profile update link sent to ${data.sentTo.length} passenger(s)`);
      } else if (data.success) {
        toast.success("Profile update link sent successfully");
      }
      
      if (data.failed && data.failed.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending profile update:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSending(false);
  };

  if (passengersWithEmail.length === 0) {
    return (
      <Button variant={variant} size={size} disabled title="No passengers have email addresses">
        <UserPen className="h-4 w-4 mr-2" />
        Request Profile Update
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
            <UserPen className="h-4 w-4 mr-2" />
          )}
          {sending ? "Sending..." : "Request Profile Update"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Profile Update Request</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will send {passengersWithEmail.length === 1 ? "an email" : `individual emails`} to {passengersWithEmail.length === 1 ? "the following passenger" : `${passengersWithEmail.length} passengers`} with secure links to update their profile information:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {passengersWithEmail.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong> ({p.email})
                </li>
              ))}
            </ul>
            <p className="text-sm mt-3">
              Each link allows them to update: contact details, emergency contacts, dietary
              requirements, medical conditions, and accessibility needs.
            </p>
            <p className="text-sm text-muted-foreground">
              Links will expire in 72 hours and can be used multiple times.
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
