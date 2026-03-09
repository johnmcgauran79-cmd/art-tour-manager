import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
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

interface SendWaiverRequestButtonProps {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  tourName: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export const SendWaiverRequestButton = ({
  bookingId,
  customerName,
  customerEmail,
  tourName,
  size = "sm",
}: SendWaiverRequestButtonProps) => {
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
      const { data, error } = await supabase.functions.invoke("send-waiver-request", {
        body: { bookingId },
      });

      if (error) {
        toast.error("Failed to send waiver request");
        console.error("Waiver request error:", error);
        return;
      }

      if (data?.sentTo?.length > 0) {
        toast.success(`Waiver request sent to ${data.sentTo.join(", ")}`);
      }

      if (data?.failed?.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending waiver request:", err);
      toast.error("Failed to send waiver request");
    }
    setSending(false);
  };

  if (!customerEmail) {
    return (
      <Button variant="outline" size={size} disabled title="No email address available">
        <FileText className="mr-2 h-4 w-4" />
        Send Waiver
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
            <FileText className="mr-2 h-4 w-4" />
          )}
          {sending ? "Sending..." : "Send Waiver"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Waiver Request</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will send a waiver form email to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>{customerName}</strong> ({customerEmail})
              </li>
            </ul>
            <p className="text-sm mt-3">
              The email contains a secure link for the passenger to review and sign the waiver for <strong>{tourName}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 7 days.
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
