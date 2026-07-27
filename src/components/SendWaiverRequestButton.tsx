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

interface PassengerLite {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface SendWaiverRequestButtonProps {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  tourName: string;
  size?: "sm" | "default" | "lg" | "icon";
  leadPassenger?: PassengerLite | null;
  passenger2?: PassengerLite | null;
  passenger3?: PassengerLite | null;
  passengerCount?: number;
}

const fullName = (p?: PassengerLite | null) =>
  p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "";

export const SendWaiverRequestButton = ({
  bookingId,
  customerName,
  customerEmail,
  tourName,
  size = "sm",
  leadPassenger,
  passenger2,
  passenger3,
  passengerCount,
}: SendWaiverRequestButtonProps) => {
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const covered: PassengerLite[] = [];
  if (leadPassenger) covered.push(leadPassenger);
  if ((passengerCount ?? 3) >= 2 && passenger2) covered.push(passenger2);
  if ((passengerCount ?? 3) >= 3 && passenger3) covered.push(passenger3);

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("No email address found for the lead passenger");
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
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will email the waiver form to the lead passenger{" "}
                <strong>{customerName}</strong> ({customerEmail}). One signature covers
                all passengers on this booking for <strong>{tourName}</strong>.
              </p>
              {covered.length > 1 && (
                <div>
                  <p className="text-sm font-medium mb-1">Covered passengers:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {covered.map((p) => (
                      <li key={p.id}>{fullName(p) || p.email}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">The link will expire in 7 days.</p>
            </div>
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