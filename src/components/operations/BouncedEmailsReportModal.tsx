import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailSuppressionsManagement } from "@/components/email/EmailSuppressionsManagement";

interface BouncedEmailsReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BouncedEmailsReportModal = ({ open, onOpenChange }: BouncedEmailsReportModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bounced Emails Report</DialogTitle>
        </DialogHeader>
        <EmailSuppressionsManagement />
      </DialogContent>
    </Dialog>
  );
};