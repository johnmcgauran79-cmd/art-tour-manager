import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bus, Loader2 } from "lucide-react";
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

interface SendPickupRequestButtonProps {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  tourName: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export const SendPickupRequestButton = ({
  bookingId,
  customerName,
  customerEmail,
  tourName,
  size = "sm",
}: SendPickupRequestButtonProps) => {
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("No email address found for this booking");
      return;
    }

    setSending(true);
    setOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("send-pickup-request", {
        body: { bookingId },
      });

      if (error) {
        toast.error("Failed to send pickup location request");
        console.error("Pickup request error:", error);
        return;
      }

      if (data?.sentTo?.length > 0) {
        toast.success(`Pickup location request sent to ${data.sentTo.join(", ")}`);
      }

      if (data?.failed?.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending pickup request:", err);
      toast.error("Failed to send pickup location request");
    }
    setSending(false);
  };

  if (!customerEmail) {
    return (
      <Button variant="outline" size={size} disabled title="No email address available">
        <Bus className="mr-2 h-4 w-4" />
        Send Pickup Request
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size={size} disabled={sending}>
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bus className="mr-2 h-4 w-4" />
          )}
          {sending ? "Sending..." : "Send Pickup Request"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Pickup Location Request</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will send a pickup location selection email to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>{customerName}</strong> ({customerEmail})
              </li>
            </ul>
            <p className="text-sm mt-3">
              The email contains a secure link for the passenger to select their preferred pickup location for <strong>{tourName}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 72 hours.
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
};
