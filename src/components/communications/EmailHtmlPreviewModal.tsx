import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Mail } from "lucide-react";

export interface EmailPreviewTarget {
  subject: string;
  recipientEmail: string;
  recipientName?: string | null;
  sentAt?: string | null;
  fromEmail?: string | null;
  renderedHtml?: string | null;
}

interface Props {
  target: EmailPreviewTarget | null;
  onClose: () => void;
}

export const EmailHtmlPreviewModal = ({ target, onClose }: Props) => (
  <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {target?.subject || "Email preview"}
        </DialogTitle>
        <DialogDescription>
          {target?.recipientName ? `${target.recipientName} · ` : ""}
          {target?.recipientEmail}
          {target?.sentAt
            ? ` · Sent ${format(new Date(target.sentAt), "dd/MM/yyyy 'at' HH:mm")}`
            : ""}
          {target?.fromEmail ? ` · From ${target.fromEmail}` : ""}
        </DialogDescription>
      </DialogHeader>

      {target?.renderedHtml ? (
        <iframe
          title="Email preview"
          className="w-full flex-1 min-h-[60vh] rounded-md border bg-white"
          sandbox=""
          srcDoc={target.renderedHtml}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-md border p-10 text-center text-sm text-muted-foreground">
          No stored copy of this email is available. Only emails sent after the
          Communications reporting update store a full preview.
        </div>
      )}
    </DialogContent>
  </Dialog>
);
