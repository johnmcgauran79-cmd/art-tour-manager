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

interface SendTravelDocsRequestButtonProps {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  tourName: string;
  travelDocsRequired: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SendTravelDocsRequestButton({
  bookingId,
  customerName,
  customerEmail,
  tourName,
  travelDocsRequired,
  variant = "outline",
  size = "sm",
}: SendTravelDocsRequestButtonProps) {
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("Customer does not have an email address");
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

      toast.success(`Travel documents request sent to ${customerEmail}`);
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

  if (!customerEmail) {
    return (
      <Button variant={variant} size={size} disabled title="Customer has no email address">
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
              This will send an email to <strong>{customerName}</strong> ({customerEmail}) requesting
              their passport details for <strong>{tourName}</strong>.
            </p>
            <p className="text-sm">
              The link allows them to securely submit: passport number, country of issue, expiry
              date, nationality, and additional ID.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 72 hours. Passport data is automatically purged 30 days after the tour ends.
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
