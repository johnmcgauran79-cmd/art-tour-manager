import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw } from "lucide-react";

interface InvoiceSyncProgressModalProps {
  open: boolean;
  syncType?: string;
}

const INVOICE_SYNC_MESSAGES = [
  "Connecting to Xero...",
  "Fetching invoice data...",
  "Matching invoices to bookings...",
  "Comparing payment statuses...",
  "Analysing changes...",
  "Preparing review...",
];

const CONTACT_SYNC_MESSAGES = [
  "Connecting to Xero...",
  "Fetching contact data...",
  "Checking existing contacts...",
  "Preparing sync summary...",
];

const PHONE_SYNC_MESSAGES = [
  "Connecting to Xero...",
  "Fetching contact phone numbers...",
  "Matching contacts...",
  "Preparing phone review...",
];

const STATE_SYNC_MESSAGES = [
  "Connecting to Xero...",
  "Fetching contact addresses...",
  "Matching contacts...",
  "Checking missing states...",
  "Preparing state review...",
];

export const InvoiceSyncProgressModal = ({ open, syncType = "invoices" }: InvoiceSyncProgressModalProps) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const getMessages = () => {
    switch (syncType) {
      case "contacts": return CONTACT_SYNC_MESSAGES;
      case "phones": return PHONE_SYNC_MESSAGES;
      case "states": return STATE_SYNC_MESSAGES;
      default: return INVOICE_SYNC_MESSAGES;
    }
  };

  const messages = getMessages();

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    // Simulate progress that slows down as it approaches 90%
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Cap at 90 until actually done
        const remaining = 90 - prev;
        const increment = Math.max(0.5, remaining * 0.08);
        return Math.min(90, prev + increment);
      });
    }, 300);

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= messages.length - 1) return prev;
        return prev + 1;
      });
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [open, messages.length]);

  const getTitle = () => {
    switch (syncType) {
      case "contacts": return "Syncing Contacts";
      case "phones": return "Syncing Phone Numbers";
      case "states": return "Checking Missing States";
      case "receipts": return "Syncing Payment Receipts";
      default: return "Syncing Invoices";
    }
  };

  const getDescription = () => {
    switch (syncType) {
      case "contacts": return "This may take a minute depending on the number of contacts. Please don't close this window.";
      case "phones": return "This may take a minute depending on the number of contacts. Please don't close this window.";
      case "states": return "This may take a minute depending on the number of Xero contacts. Existing states will not be overwritten.";
      case "receipts": return "This may take a minute depending on the number of invoice mappings. Please don't close this window.";
      default: return "This may take a minute depending on the number of bookings. Please don't close this window.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="animate-pulse">{messages[messageIndex]}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            {getDescription()}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
