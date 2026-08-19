import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PassengerInfo {
  name: string;
  email: string | null;
}

interface PublishedForm {
  id: string;
  form_title: string;
  response_mode: string;
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
  bookingId, tourName, tourId, leadPassenger, passenger2, passenger3,
  variant = "outline", size = "sm",
}: SendCustomFormRequestButtonProps) {
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [publishedForms, setPublishedForms] = useState<PublishedForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("tour_custom_forms")
      .select("id, form_title, response_mode")
      .eq("tour_id", tourId)
      .eq("is_published", true)
      .order("created_at")
      .then(({ data }) => {
        const forms = (data || []) as PublishedForm[];
        setPublishedForms(forms);
        if (forms.length === 1) setSelectedFormId(forms[0].id);
        setLoaded(true);
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
    if (!selectedFormId) {
      toast.error("Please select a form");
      return;
    }

    setSending(true);
    setOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-custom-form-request", {
        body: { bookingId, formId: selectedFormId },
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

  if (!loaded || publishedForms.length === 0) return null;
  if (passengersWithEmail.length === 0) {
    return (
      <Button variant={variant} size={size} disabled title="No passengers have email addresses">
        <FileText className="h-4 w-4 mr-2" /> Send Custom Form
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          {sending ? "Sending..." : "Send Custom Form"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Custom Form Request</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {publishedForms.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-foreground">Select Form</Label>
                  <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                    <SelectTrigger><SelectValue placeholder="Choose a form..." /></SelectTrigger>
                    <SelectContent>
                      {publishedForms.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.form_title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p>
                This will send {passengersWithEmail.length === 1 ? "an email" : "individual emails"} to{" "}
                {passengersWithEmail.length === 1 ? "the following passenger" : `${passengersWithEmail.length} passengers`}{" "}
                requesting them to complete <strong>{publishedForms.find(f => f.id === selectedFormId)?.form_title || 'the form'}</strong> for <strong>{tourName}</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {passengersWithEmail.map((p, i) => (
                  <li key={i}><strong>{p.name}</strong> ({p.email})</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">Each passenger will receive a unique link that expires in 7 days.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={!selectedFormId}>Send Request</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
