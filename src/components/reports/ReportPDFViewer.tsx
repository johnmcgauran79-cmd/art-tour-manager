import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import html2pdf from "html2pdf.js";

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
    
    const opt = {
      margin: 1,
      filename: `${tourName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(element).save();
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