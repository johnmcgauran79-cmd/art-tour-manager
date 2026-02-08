import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("No email address found for this booking");
      return;
    }

    setSending(true);
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

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleSend}
      disabled={sending || !customerEmail}
      title={!customerEmail ? "No email address available" : `Send waiver form to ${customerName}`}
    >
      {sending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      Send Waiver
    </Button>
  );
};
