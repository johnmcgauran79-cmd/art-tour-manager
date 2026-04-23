import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserEmails } from "@/hooks/useUserEmails";

interface EmailRoomingListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelName: string;
  tourName: string;
  defaultToEmail?: string;
  onSend: (emailData: {
    from: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    message: string;
  }) => void;
  isSending: boolean;
}

export const EmailRoomingListModal = ({
  open,
  onOpenChange,
  hotelName,
  tourName,
  defaultToEmail,
  onSend,
  isSending,
}: EmailRoomingListModalProps) => {
  const { user } = useAuth();
  const userEmail = user?.email || "";
  const { data: fromEmails = [] } = useUserEmails();
  const dropdownEmails = Array.from(
    new Set([...(userEmail ? [userEmail] : []), ...fromEmails])
  );
  
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(defaultToEmail || "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(`Rooming List - ${hotelName} - ${tourName}`);
  const [message, setMessage] = useState(
    `Dear ${hotelName},\n\nPlease find attached the rooming list for ${tourName}.\n\nKind regards,\nOperations Team`
  );

  // Set default from email when component opens
  useEffect(() => {
    if (open && userEmail) {
      setFrom(userEmail);
    }
  }, [open, userEmail]);

  const handleSend = () => {
    onSend({ from, to, cc, bcc, subject, message });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Rooming List to Hotel
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
                {dropdownEmails.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="hotel@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (comma-separated for multiple, optional)</Label>
            <Input
              id="cc"
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bcc">BCC (comma-separated for multiple, optional)</Label>
            <Input
              id="bcc"
              type="text"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Enter your message..."
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="italic">Note: The rooming list will be included in the email body. Recipients can print to PDF using their browser's print function.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !to}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
