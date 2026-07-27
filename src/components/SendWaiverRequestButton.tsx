import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useWaiverStatus } from "@/hooks/useWaiverStatus";
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
  const { data: waivers = [] } = useWaiverStatus(open ? bookingId : undefined);

  const slots = useMemo(() => {
    const list: { slot: number; passenger: PassengerLite }[] = [];
    if (leadPassenger) list.push({ slot: 1, passenger: leadPassenger });
    if ((passengerCount ?? 3) >= 2 && passenger2) list.push({ slot: 2, passenger: passenger2 });
    if ((passengerCount ?? 3) >= 3 && passenger3) list.push({ slot: 3, passenger: passenger3 });
    // Include all passengers — pax without a personal email are signable via the lead's token,
    // so they should still be selectable (the request will be routed to the lead's email).
    return list;
  }, [leadPassenger, passenger2, passenger3, passengerCount]);

  const signedSlotSet = useMemo(() => new Set(waivers.map(w => w.passenger_slot)), [waivers]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Initialise selection to unsigned passengers whenever dialog opens / data loads
  const initKey = `${open}-${waivers.length}-${slots.map(s => s.passenger.id).join(',')}`;
  useMemo(() => {
    if (!open) return;
    const next = new Set<string>();
    slots.forEach(s => { if (!signedSlotSet.has(s.slot)) next.add(s.passenger.id); });
    setSelected(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const hasMultiple = slots.length > 1;

  const handleSend = async () => {
    if (!customerEmail) {
      toast.error("No email address found for this booking");
      return;
    }
    const customerIds = hasMultiple ? Array.from(selected) : undefined;
    if (hasMultiple && customerIds!.length === 0) {
      toast.error("Please select at least one passenger");
      return;
    }

    setSending(true);
    setOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("send-waiver-request", {
        body: { bookingId, ...(customerIds ? { customerIds } : {}) },
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
              {hasMultiple ? (
                <>
                  <p>Select which passenger(s) to send the waiver form to for <strong>{tourName}</strong>:</p>
                  <div className="space-y-2">
                    {slots.map(({ slot, passenger }) => {
                      const alreadySigned = signedSlotSet.has(slot);
                      const id = passenger.id;
                      const label = `${passenger.first_name ?? ''} ${passenger.last_name ?? ''}`.trim() || passenger.email || `Pax ${slot}`;
                      const hasOwnEmail = !!passenger.email;
                      return (
                        <label
                          key={id}
                          className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected.has(id)}
                            onCheckedChange={() => toggle(id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-foreground">
                              Pax {slot}: {label}
                              {alreadySigned && (
                                <span className="ml-2 text-xs text-green-600 font-normal">(already signed)</span>
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              {hasOwnEmail
                                ? passenger.email
                                : `No email — request will be sent to the lead passenger (${customerEmail})`}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p>This will send a waiver form email to:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>{customerName}</strong> ({customerEmail})</li>
                  </ul>
                  <p className="text-sm mt-3">
                    The email contains a secure link for the passenger to review and sign the waiver for <strong>{tourName}</strong>.
                  </p>
                </>
              )}
              <p className="text-sm text-muted-foreground">The link will expire in 7 days.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSend}
            disabled={hasMultiple && selected.size === 0}
          >
            Send Request{hasMultiple && selected.size > 0 ? ` (${selected.size})` : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
