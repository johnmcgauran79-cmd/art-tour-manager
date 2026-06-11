import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { cn } from "@/lib/utils";
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  PersonalEvent,
} from "@/hooks/usePersonalEvents";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];
const FMT = "yyyy-MM-dd'T'HH:mm";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: PersonalEvent | null;
  /** Default date (yyyy-MM-dd) when creating from a day cell. */
  defaultDate?: string;
}

export const EventDialog = ({ open, onOpenChange, event, defaultDate }: EventDialogProps) => {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setAllDay(event.all_day);
      setStart(format(parseISO(event.starts_at), FMT));
      setEnd(format(parseISO(event.ends_at), FMT));
      setColor(event.color);
    } else {
      const base = defaultDate ? `${defaultDate}T09:00` : format(new Date(), FMT);
      const baseEnd = defaultDate ? `${defaultDate}T10:00` : format(new Date(Date.now() + 3600000), FMT);
      setTitle("");
      setDescription("");
      setAllDay(false);
      setStart(base);
      setEnd(baseEnd);
      setColor(COLORS[0]);
    }
  }, [open, event, defaultDate]);

  const handleSave = async () => {
    if (!title.trim() || !start || !end) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      all_day: allDay,
      color,
    };
    if (event) {
      await updateEvent.mutateAsync({ id: event.id, ...payload });
    } else {
      await createEvent.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="all-day">All day</Label>
            <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>
          <div className="space-y-1.5">
            <Label>Starts</Label>
            <DateTimePicker value={start} onChange={setStart} />
          </div>
          <div className="space-y-1.5">
            <Label>Ends</Label>
            <DateTimePicker value={end} onChange={setEnd} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {event && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => {
                deleteEvent.mutate(event.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};