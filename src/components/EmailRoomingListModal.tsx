import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, X } from "lucide-react";

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
  const [from, setFrom] = useState("operations@example.com");
  const [to, setTo] = useState(defaultToEmail || "");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState(
    `Dear ${hotelName},\n\nPlease find attached the rooming list for ${tourName}.\n\nKind regards,\nOperations Team`
  );

  const handleSend = () => {
    onSend({ from, to, cc, message });
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operations@example.com">operations@example.com</SelectItem>
                <SelectItem value="bookings@example.com">bookings@example.com</SelectItem>
                <SelectItem value="admin@example.com">admin@example.com</SelectItem>
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
            <Label htmlFor="cc">CC (optional)</Label>
            <Input
              id="cc"
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
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
            <p><strong>Subject:</strong> Rooming List - {hotelName} - {tourName}</p>
            <p className="mt-1"><strong>Attachment:</strong> {hotelName}-rooming-list.pdf</p>
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
