import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download } from "lucide-react";
import { Itinerary } from "@/hooks/useItinerary";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ItineraryPDFViewer } from "./ItineraryPDFViewer";

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
  const [includeAdditionalInfo, setIncludeAdditionalInfo] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState('');
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      console.log('Generating itinerary document for tour:', tour.name);
      const { data, error } = await supabase.functions.invoke('generate-itinerary-document', {
        body: {
          tourId: tour.id,
          itineraryId: itinerary.id,
          format: 'html',
          options: {
            includeHotels,
            includeTourInfo,
            includeAdditionalInfo
          }
        }
      });

      if (error) throw error;

      console.log('Document generated, HTML length:', data?.html?.length || 0);
      
      // Set the generated HTML and show viewer first
      setGeneratedHTML(data.html);
      
      // Use a small delay to ensure state is set before opening viewer
      setTimeout(() => {
        setShowViewer(true);
        onOpenChange(false); // Close the options modal after viewer opens
      }, 100);

      toast({
        title: "Document Generated",
        description: "Itinerary document has been generated successfully.",
      });
      
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
    <>
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
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="additional-info"
                    checked={includeAdditionalInfo}
                    onCheckedChange={(checked) => setIncludeAdditionalInfo(checked as boolean)}
                  />
                  <Label htmlFor="additional-info">Additional Information Sections</Label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                This will generate a formatted itinerary document with the selected options and open it in a preview window with print and download options.
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
              <FileText className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItineraryPDFViewer
        open={showViewer}
        onOpenChange={setShowViewer}
        htmlContent={generatedHTML}
        tourName={tour.name}
        tourId={tour.id}
        itineraryId={itinerary.id}
      />
    </>
  );
};