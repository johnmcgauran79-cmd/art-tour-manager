import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface ReportPDFViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string;
  reportTitle: string;
  tourName: string;
}

export const ReportPDFViewer = ({ 
  open, 
  onOpenChange, 
  htmlContent, 
  reportTitle,
  tourName 
}: ReportPDFViewerProps) => {
  
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

  const handleDownload = () => {
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);
    
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename: `${tourName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.85 },
      html2canvas: { scale: 1.5, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(element);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{reportTitle} - PDF Preview</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden border rounded-lg bg-white">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full border-0"
            title="Report Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};