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

interface SendProfileUpdateButtonProps {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  bookingId?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SendProfileUpdateButton({
  customerId,
  customerName,
  customerEmail,
  bookingId,
  variant = "outline",
  size = "sm",
}: SendProfileUpdateButtonProps) {
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
      const { data, error } = await supabase.functions.invoke("send-profile-update-request", {
        body: { customerId, bookingId },
      });

      if (error) {
        console.error("Send error:", error);
        toast.error(data?.error || "Failed to send profile update request");
        setSending(false);
        return;
      }

      toast.success(`Profile update link sent to ${customerEmail}`);
    } catch (err: any) {
      console.error("Error sending profile update:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSending(false);
  };

  if (!customerEmail) {
    return (
      <Button variant={variant} size={size} disabled title="Customer has no email address">
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
              This will send an email to <strong>{customerName}</strong> ({customerEmail}) with a
              secure link to update their profile information.
            </p>
            <p className="text-sm">
              The link allows them to update: contact details, emergency contacts, dietary
              requirements, medical conditions, and accessibility needs.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 24 hours and can be used multiple times.
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
