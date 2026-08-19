import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

interface InvoiceSyncProgressModalProps {
  open: boolean;
  syncType?: string;
}

const SYNC_MESSAGES = [
  "Connecting to Xero...",
  "Fetching invoice data...",
  "Matching invoices to bookings...",
  "Comparing payment statuses...",
  "Analysing changes...",
  "Preparing review...",
];

export const InvoiceSyncProgressModal = ({ open, syncType = "invoices" }: InvoiceSyncProgressModalProps) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

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
        if (prev >= SYNC_MESSAGES.length - 1) return prev;
        return prev + 1;
      });
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [open]);

  const getTitle = () => {
    switch (syncType) {
      case "contacts": return "Syncing Contacts";
      case "phones": return "Syncing Phone Numbers";
      default: return "Syncing Invoices";
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
            <span className="animate-pulse">{SYNC_MESSAGES[messageIndex]}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            This may take a minute depending on the number of bookings. Please don't close this window.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
