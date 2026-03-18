import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Mail } from "lucide-react";
import { useState } from "react";
import { EmailItineraryModal } from "./EmailItineraryModal";

interface ItineraryPDFViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string;
  tourName: string;
  tourId: string;
  itineraryId: string;
}

export const ItineraryPDFViewer = ({ 
  open, 
  onOpenChange, 
  htmlContent, 
  tourName,
  tourId,
  itineraryId
}: ItineraryPDFViewerProps) => {
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Itinerary Preview</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailModal(true)}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Send Itinerary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden border rounded-lg bg-white">
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              title="Itinerary Preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      <EmailItineraryModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        tour={{ id: tourId, name: tourName }}
        itineraryId={itineraryId}
      />
    </>
  );
};