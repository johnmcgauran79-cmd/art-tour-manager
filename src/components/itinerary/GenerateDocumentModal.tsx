import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download } from "lucide-react";
import { Itinerary } from "@/hooks/useItinerary";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GenerateDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    days: number;
    nights: number;
    location: string;
  };
  itinerary: Itinerary;
}

export const GenerateDocumentModal = ({ 
  open, 
  onOpenChange, 
  tour, 
  itinerary 
}: GenerateDocumentModalProps) => {
  const [includeHotels, setIncludeHotels] = useState(true);
  const [includeTourInfo, setIncludeTourInfo] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary-document', {
        body: {
          tourId: tour.id,
          itineraryId: itinerary.id,
          format,
          options: {
            includeHotels,
            includeTourInfo
          }
        }
      });

      if (error) throw error;

      if (format === 'pdf') {
        if (data.pdfBuffer && !data.isPrintReady) {
          // Handle actual PDF download
          const blob = new Blob([new Uint8Array(data.pdfBuffer)], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tour.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // Fallback: Open HTML in new window with print dialog
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(data.html);
            newWindow.document.close();
            // Trigger print dialog after a short delay
            setTimeout(() => {
              newWindow.print();
            }, 1000);
          }
        }
      } else {
        // Handle HTML view
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(data.html);
          newWindow.document.close();
        }
      }

      toast({
        title: "Document Generated",
        description: `Itinerary ${format.toUpperCase()} has been generated successfully.`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error generating document:', error);
      toast({
        title: "Error",
        description: "Failed to generate document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Itinerary Document
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-medium">Document Format</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="pdf"
                  name="format"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  className="w-4 h-4 text-brand-navy"
                />
                <Label htmlFor="pdf">PDF (Download)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="html"
                  name="format"
                  checked={format === 'html'}
                  onChange={() => setFormat('html')}
                  className="w-4 h-4 text-brand-navy"
                />
                <Label htmlFor="html">HTML (View)</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Include in Document</Label>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tour-info"
                  checked={includeTourInfo}
                  onCheckedChange={(checked) => setIncludeTourInfo(checked as boolean)}
                />
                <Label htmlFor="tour-info">Tour Information (dates, location, etc.)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hotels"
                  checked={includeHotels}
                  onCheckedChange={(checked) => setIncludeHotels(checked as boolean)}
                />
                <Label htmlFor="hotels">Hotel Information</Label>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              This will generate a formatted itinerary document with the selected options. 
              {format === 'pdf' ? ' The PDF will be downloaded to your device.' : ' The HTML will open in a new window for viewing and printing.'}
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-brand-navy hover:bg-brand-navy/90"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : `Generate ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};