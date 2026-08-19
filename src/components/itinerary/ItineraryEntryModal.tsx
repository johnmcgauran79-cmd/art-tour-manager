import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItineraryDay, ItineraryEntry, useUpdateItineraryEntry } from "@/hooks/useItinerary";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { PermissionErrorDialog } from "@/components/shared/PermissionErrorDialog";

interface ItineraryEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: ItineraryDay;
  entry?: ItineraryEntry | null;
  tourId: string;
  tourName?: string;
}

export const ItineraryEntryModal = ({ 
  open, 
  onOpenChange, 
  day, 
  entry, 
  tourId,
  tourName 
}: ItineraryEntryModalProps) => {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  
  const updateEntry = useUpdateItineraryEntry();

  // Quill modules configuration for rich text editing
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ],
  };

  useEffect(() => {
    if (entry) {
      setSubject(entry.subject);
      setContent(entry.content || "");
    } else {
      setSubject("");
      setContent("");
    }
  }, [entry, open]);

  const handleSubmit = () => {
    if (!subject.trim()) return;

    const sortOrder = entry ? entry.sort_order : day.entries.length;

    updateEntry.mutate({
      entryId: entry?.id,
      dayId: day.id,
      tourId,
      subject: subject.trim(),
      content: content.trim() || null,
      sortOrder
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <div className="space-y-3">
            {tourName && (
              <AppBreadcrumbs
                items={[
                  { label: "Tours" },
                  { label: tourName },
                  { label: "Itinerary" },
                  { label: `Day ${day.day_number}` },
                ]}
              />
            )}
            <DialogTitle>
              {entry ? 'Edit Activity' : 'Add New Activity'}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="subject">Activity Title *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Breakfast at Hotel, City Tour, Free Time"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Activity Description</Label>
            <div className="mt-2 border rounded-md">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                className="bg-white"
                style={{ minHeight: '350px' }}
                placeholder="Add detailed activity information with formatting. Use the toolbar to add headers, lists, bold text, colors, and more..."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use the formatting toolbar to style your content. All formatting will be preserved in generated documents.
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
            onClick={handleSubmit}
            disabled={!subject.trim() || updateEntry.isPending}
            className="bg-brand-navy hover:bg-brand-navy/90"
          >
            {updateEntry.isPending ? 'Saving...' : (entry ? 'Update' : 'Add Activity')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <PermissionErrorDialog
      open={updateEntry.permissionError}
      onOpenChange={(open) => updateEntry.setPermissionError(open)}
      action={entry ? "edit itinerary entries" : "add itinerary entries"}
    />
    </>
  );
};