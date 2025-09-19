import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ItineraryDay, ItineraryEntry, useUpdateItineraryEntry } from "@/hooks/useItinerary";

interface ItineraryEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: ItineraryDay;
  entry?: ItineraryEntry | null;
  tourId: string;
}

export const ItineraryEntryModal = ({ 
  open, 
  onOpenChange, 
  day, 
  entry, 
  tourId 
}: ItineraryEntryModalProps) => {
  const [timeSlot, setTimeSlot] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  
  const updateEntry = useUpdateItineraryEntry();

  useEffect(() => {
    if (entry) {
      setTimeSlot(entry.time_slot || "");
      setSubject(entry.subject);
      setContent(entry.content || "");
    } else {
      setTimeSlot("");
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
      timeSlot: timeSlot || null,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {entry ? 'Edit Activity' : 'Add New Activity'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="time-slot">Time (optional)</Label>
            <Input
              id="time-slot"
              type="time"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              placeholder="e.g., 09:00"
            />
          </div>
          
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
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detailed description of the activity, including location, duration, what's included, etc."
              rows={4}
            />
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
  );
};