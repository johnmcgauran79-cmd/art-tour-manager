import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("No email address found for this booking");
      return;
    }

    setSending(true);
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

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleSend}
      disabled={sending || !customerEmail}
      title={!customerEmail ? "No email address available" : `Send pickup location request to ${customerName}`}
    >
      {sending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Bus className="mr-2 h-4 w-4" />
      )}
      Send Pickup Request
    </Button>
  );
};
