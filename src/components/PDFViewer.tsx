
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertCircle } from "lucide-react";

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath: string;
}

export const PDFViewer = ({ isOpen, onClose, fileName, filePath }: PDFViewerProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPDF = async () => {
    if (pdfUrl) return; // Already loaded
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use signed URL instead of blob URL for better browser compatibility
      const { data, error: signedUrlError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(filePath, 3600); // Valid for 1 hour

      if (signedUrlError) throw signedUrlError;

      setPdfUrl(data.signedUrl);
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
      // Reset URL when dialog closes
      setPdfUrl(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{fileName}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p>Loading PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            </div>
          )}
          
          {pdfUrl && !isLoading && !error && (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full"
              title={fileName}
            >
              <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Your browser cannot display this PDF inline.
                </p>
                <Button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = pdfUrl;
                    a.download = fileName;
                    a.click();
                  }}
                >
                  Download PDF
                </Button>
              </div>
            </object>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
