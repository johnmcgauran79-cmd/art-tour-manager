import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendItinerary } from "@/hooks/useItineraryEmail";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Plus, X } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useToast } from "@/hooks/use-toast";

interface EmailItineraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: {
    id: string;
    name: string;
  };
  itineraryId: string;
}

export const EmailItineraryModal = ({ open, onOpenChange, tour, itineraryId }: EmailItineraryModalProps) => {
  const [recipientType, setRecipientType] = useState<"user" | "custom">("user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [subject, setSubject] = useState(`${tour.name} - Tour Itinerary`);
  const [message, setMessage] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [includeHotels, setIncludeHotels] = useState(true);
  const [includeTourInfo, setIncludeTourInfo] = useState(true);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  const sendItinerary = useSendItinerary();
  const { toast } = useToast();

  const { data: users } = useQuery({
    queryKey: ['users-for-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .order('first_name');
      
      if (error) throw error;
      return data;
    },
  });

  const handleSend = async () => {
    let recipientEmail = "";
    let recipientName = "";

    if (recipientType === "user" && selectedUserId) {
      const user = users?.find(u => u.id === selectedUserId);
      if (user) {
        recipientEmail = user.email || "";
        recipientName = `${user.first_name} ${user.last_name}`.trim();
      }
    } else if (recipientType === "custom") {
      recipientEmail = customEmail;
      recipientName = customName;
    }

    if (!recipientEmail) {
      return;
    }

    try {
      // Generate HTML content from the itinerary
      toast({
        title: "Generating PDF...",
        description: "Creating PDF attachment for email",
      });

      const { data: htmlData, error: htmlError } = await supabase.functions.invoke('generate-itinerary-document', {
        body: {
          tourId: tour.id,
          itineraryId,
          format: 'html',
          options: {
            includeHotels,
            includeTourInfo
          }
        }
      });

      if (htmlError) throw htmlError;

      // Generate PDF from HTML using html2pdf
      const element = document.createElement('div');
      element.innerHTML = htmlData.html;
      
      const opt = {
        margin: 1,
        filename: `${tour.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      
      // Convert blob to base64
      const reader = new FileReader();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      // Send email with PDF attachment
      await sendItinerary.mutateAsync({
        tourId: tour.id,
        itineraryId,
        recipientEmail,
        recipientName,
        subject,
        message,
        fromEmail: fromEmail || undefined,
        includeHotels,
        includeTourInfo,
        ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
        bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
        pdfBase64,
      });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error sending itinerary:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF and send email",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setRecipientType("user");
    setSelectedUserId("");
    setCustomEmail("");
    setCustomName("");
    setSubject(`${tour.name} - Tour Itinerary`);
    setMessage("");
    setFromEmail("");
    setIncludeHotels(true);
    setIncludeTourInfo(true);
    setCcEmails([]);
    setBccEmails([]);
    setCcInput("");
    setBccInput("");
  };

  const addCcEmail = () => {
    if (ccInput && ccInput.includes('@')) {
      setCcEmails([...ccEmails, ccInput]);
      setCcInput("");
    }
  };

  const removeCcEmail = (email: string) => {
    setCcEmails(ccEmails.filter(e => e !== email));
  };

  const addBccEmail = () => {
    if (bccInput && bccInput.includes('@')) {
      setBccEmails([...bccEmails, bccInput]);
      setBccInput("");
    }
  };

  const removeBccEmail = (email: string) => {
    setBccEmails(bccEmails.filter(e => e !== email));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Itinerary - {tour.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Type Selection */}
          <div className="space-y-2">
            <Label>Send To</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={recipientType === "user"}
                  onChange={() => setRecipientType("user")}
                />
                <span>Select User</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={recipientType === "custom"}
                  onChange={() => setRecipientType("custom")}
                />
                <span>Custom Email</span>
              </label>
            </div>
          </div>

          {/* User Selection */}
          {recipientType === "user" && (
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Email Input */}
          {recipientType === "custom" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-email">Email Address</Label>
                <Input
                  id="custom-email"
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-name">Recipient Name (Optional)</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          {/* From Email */}
          <div className="space-y-2">
            <Label htmlFor="from-email">From Email (Optional)</Label>
            <Input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>

          {/* CC Emails */}
          <div className="space-y-2">
            <Label>CC Recipients (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCcEmail())}
                placeholder="cc@example.com"
              />
              <Button type="button" size="icon" onClick={addCcEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {ccEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {ccEmails.map((email) => (
                  <div key={email} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                    <span className="text-sm">{email}</span>
                    <button onClick={() => removeCcEmail(email)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BCC Emails */}
          <div className="space-y-2">
            <Label>BCC Recipients (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBccEmail())}
                placeholder="bcc@example.com"
              />
              <Button type="button" size="icon" onClick={addBccEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {bccEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {bccEmails.map((email) => (
                  <div key={email} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                    <span className="text-sm">{email}</span>
                    <button onClick={() => removeBccEmail(email)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to accompany the itinerary..."
              rows={4}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Include in Itinerary</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-hotels"
                checked={includeHotels}
                onCheckedChange={(checked) => setIncludeHotels(checked as boolean)}
              />
              <label htmlFor="include-hotels" className="text-sm cursor-pointer">
                Include Hotel Information
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-tour-info"
                checked={includeTourInfo}
                onCheckedChange={(checked) => setIncludeTourInfo(checked as boolean)}
              />
              <label htmlFor="include-tour-info" className="text-sm cursor-pointer">
                Include Tour Information
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sendItinerary.isPending || (!selectedUserId && !customEmail)}
            >
              <Mail className="h-4 w-4 mr-2" />
              {sendItinerary.isPending ? 'Sending...' : 'Send Itinerary'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
