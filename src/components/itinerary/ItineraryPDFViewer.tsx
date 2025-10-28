import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import html2pdf from "html2pdf.js";

interface ItineraryPDFViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string;
  tourName: string;
}

export const ItineraryPDFViewer = ({ 
  open, 
  onOpenChange, 
  htmlContent, 
  tourName 
}: ItineraryPDFViewerProps) => {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open && htmlContent && !pdfUrl) {
      generatePDF();
    }
    
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, htmlContent]);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${tourName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' as const,
          compress: true
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.day-card',
          avoid: ['.day-card', '.activity', '.day-header']
        }
      };
      
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${tourName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`;
    link.click();
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Itinerary PDF</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!pdfUrl || isGenerating}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!pdfUrl || isGenerating}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden border rounded-lg bg-gray-100 flex items-center justify-center">
          {isGenerating ? (
            <div className="text-center">
              <p className="text-gray-600">Generating PDF...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="Itinerary PDF"
            />
          ) : (
            <div className="text-center">
              <p className="text-gray-600">Loading PDF...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};