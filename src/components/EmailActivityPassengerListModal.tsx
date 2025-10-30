import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailActivityPassengerListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  activityName: string;
  activityDate?: string;
  defaultToEmail?: string;
}

export const EmailActivityPassengerListModal = ({
  open,
  onOpenChange,
  activityId,
  activityName,
  activityDate,
  defaultToEmail,
}: EmailActivityPassengerListModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userEmail = user?.email || "";
  
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(defaultToEmail || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Passenger List - ${activityName}`);
  const [message, setMessage] = useState(
    `Dear Team,\n\nPlease find attached the passenger list for ${activityName}${activityDate ? ` on ${activityDate}` : ''}.\n\nKind regards,\nOperations Team`
  );
  const [isSending, setIsSending] = useState(false);

  // Set default from email when component opens
  useEffect(() => {
    if (open && userEmail) {
      setFrom(userEmail);
    }
  }, [open, userEmail]);

  // Update to email when defaultToEmail changes
  useEffect(() => {
    if (open && defaultToEmail) {
      setTo(defaultToEmail);
    }
  }, [open, defaultToEmail]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast({
        title: "Error",
        description: "Please enter a recipient email address",
        variant: "destructive",
      });
      return;
    }

    if (!from.trim()) {
      toast({
        title: "Error",
        description: "Please select a sender email address",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-activity-passenger-list', {
        body: {
          activityId,
          activityName,
          activityDate,
          emailData: {
            from,
            to: to.split(',').map(e => e.trim()).filter(Boolean),
            cc: cc.split(',').map(e => e.trim()).filter(Boolean),
            subject,
            message,
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Passenger list sent successfully",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending activity passenger list:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send passenger list",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Activity Passenger List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger id="from">
                <SelectValue placeholder="Select from email" />
              </SelectTrigger>
              <SelectContent>
                {userEmail && <SelectItem value={userEmail}>{userEmail}</SelectItem>}
                <SelectItem value="info@australianracingtours.com.au">info@australianracingtours.com.au</SelectItem>
                <SelectItem value="bookings@australianracingtours.com.au">bookings@australianracingtours.com.au</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To (comma-separated for multiple)</Label>
            <Input
              id="to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="venue@example.com, contact@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (comma-separated, optional)</Label>
            <Input
              id="cc"
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="team@example.com, manager@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Enter your message here..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send Email with PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};