import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail } from "lucide-react";
import { SentEmailsReport } from "./SentEmailsReport";

interface SentEmailsReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId?: string | null;
  tourName?: string | null;
}

export const SentEmailsReportModal = ({
  open,
  onOpenChange,
  tourId,
  tourName,
}: SentEmailsReportModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Sent Emails Report{tourName ? ` — ${tourName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Chronological log of every individual and bulk email sent. Bulk
            sends are grouped — expand to see each recipient.
          </DialogDescription>
        </DialogHeader>
        <SentEmailsReport tourId={tourId ?? null} />
      </DialogContent>
    </Dialog>
  );
};
