import { useState, useEffect } from "react";
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

interface PassengerInfo {
  name: string;
  email: string | null;
}

interface SendCustomFormRequestButtonProps {
  bookingId: string;
  tourName: string;
  tourId: string;
  leadPassenger?: PassengerInfo;
  passenger2?: PassengerInfo | null;
  passenger3?: PassengerInfo | null;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SendCustomFormRequestButton({
  bookingId,
  tourName,
  tourId,
  leadPassenger,
  passenger2,
  passenger3,
  variant = "outline",
  size = "sm",
}: SendCustomFormRequestButtonProps) {
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasForm, setHasForm] = useState<boolean | null>(null);

  // Check if tour has a published custom form
  useEffect(() => {
    supabase
      .from("tour_custom_forms")
      .select("id")
      .eq("tour_id", tourId)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => {
        setHasForm(!!data);
      });
  }, [tourId]);

  const passengersWithEmail: PassengerInfo[] = [
    leadPassenger?.email ? leadPassenger : null,
    passenger2?.email ? passenger2 : null,
    passenger3?.email ? passenger3 : null,
  ].filter(Boolean) as PassengerInfo[];

  const handleSend = async () => {
    if (passengersWithEmail.length === 0) {
      toast.error("No passengers have email addresses");
      return;
    }

    setSending(true);
    setOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-custom-form-request", {
        body: { bookingId },
      });

      if (error) {
        console.error("Send error:", error);
        toast.error(data?.error || "Failed to send custom form request");
        setSending(false);
        return;
      }

      if (data.sentTo && data.sentTo.length > 0) {
        toast.success(`Custom form request sent to ${data.sentTo.length} recipient(s)`);
      } else if (data.success) {
        toast.success("Custom form request sent successfully");
      }

      if (data.failed && data.failed.length > 0) {
        toast.warning(`Failed to send to: ${data.failed.join(", ")}`);
      }
    } catch (err: any) {
      console.error("Error sending custom form request:", err);
      toast.error("An error occurred. Please try again.");
    }

    setSending(false);
  };

  // Don't render if no published form exists
  if (hasForm === false || hasForm === null) {
    return null;
  }

  if (passengersWithEmail.length === 0) {
    return (
      <Button variant={variant} size={size} disabled title="No passengers have email addresses">
        <FileText className="h-4 w-4 mr-2" />
        Send Custom Form
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
            <FileText className="h-4 w-4 mr-2" />
          )}
          {sending ? "Sending..." : "Send Custom Form"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Custom Form Request</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will send {passengersWithEmail.length === 1 ? "an email" : "individual emails"} to{" "}
              {passengersWithEmail.length === 1
                ? "the following passenger"
                : `${passengersWithEmail.length} passengers`}{" "}
              requesting them to complete the custom form for <strong>{tourName}</strong>:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {passengersWithEmail.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong> ({p.email})
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Each passenger will receive a unique link that expires in 72 hours.
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
