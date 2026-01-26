import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath: string;
}

export const PDFViewer = ({ isOpen, onClose, fileName, filePath }: PDFViewerProps) => {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const loadPDF = async () => {
    if (pdfData) return; // Already loaded
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Download the PDF as binary data
      const { data, error: downloadError } = await supabase.storage
        .from('attachments')
        .download(filePath);

      if (downloadError) throw downloadError;

      const arrayBuffer = await data.arrayBuffer();
      setPdfData(arrayBuffer);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF file');
    } finally {
      setIsLoading(false);
    }
  };

  // Load PDF when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadPDF();
    } else {
      // Reset state when dialog closes
      setPdfData(null);
      setPageNumber(1);
      setNumPages(0);
      setError(null);
    }
  }, [isOpen]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF document:', error);
    setError('Failed to load PDF document');
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate mr-4">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto flex flex-col items-center bg-muted/30 p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p>Loading PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            </div>
          )}
          
          {pdfData && !isLoading && !error && (
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              <Page 
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
                width={Math.min(window.innerWidth * 0.85, 900)}
              />
            </Document>
          )}
        </div>

        {numPages > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};