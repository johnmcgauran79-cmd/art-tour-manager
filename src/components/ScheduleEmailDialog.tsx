import { useState } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

interface ScheduleEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (scheduledAt: string) => void;
  emailCount: number;
  isPending?: boolean;
}

export const ScheduleEmailDialog = ({
  open,
  onOpenChange,
  onSchedule,
  emailCount,
  isPending,
}: ScheduleEmailDialogProps) => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { data: settings } = useGeneralSettings();

  const timezone = settings?.find(s => s.setting_key === 'display_timezone')?.setting_value || 'Australia/Melbourne';
  const tzString = typeof timezone === 'string' ? timezone : 'Australia/Melbourne';

  const handleSchedule = () => {
    if (!date) return;

    const [hours, minutes] = time.split(':').map(Number);
    
    // Create the date in the user's timezone
    // We construct the ISO string using the timezone offset
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    
    // Use a temporary date to calculate the timezone offset
    const tempDate = new Date(`${dateStr}T${timeStr}`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzString,
      timeZoneName: 'longOffset',
    });
    
    // Get timezone offset
    const parts = formatter.formatToParts(tempDate);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offsetStr = offsetPart?.value?.replace('GMT', '') || '+00:00';
    
    const isoString = `${dateStr}T${timeStr}${offsetStr}`;
    const scheduledDate = new Date(isoString);
    
    if (scheduledDate <= new Date()) {
      return; // Don't allow past dates
    }

    onSchedule(scheduledDate.toISOString());
  };

  // Format the current selection for display
  const getPreviewTime = () => {
    if (!date) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const previewDate = new Date(date);
    previewDate.setHours(hours, minutes, 0, 0);
    try {
      return formatInTimeZone(previewDate, tzString, "EEE d MMM yyyy 'at' h:mm a zzz");
    } catch {
      return format(previewDate, "EEE d MMM yyyy 'at' h:mm a");
    }
  };

  const isValid = date && time && (() => {
    const [hours, minutes] = time.split(':').map(Number);
    const checkDate = new Date(date);
    checkDate.setHours(hours, minutes, 0, 0);
    return checkDate > new Date();
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedule Email Send
          </DialogTitle>
          <DialogDescription>
            Choose when to send {emailCount} email{emailCount !== 1 ? 's' : ''}. 
            Scheduled emails will appear in the approval queue for review before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Time ({tzString.split('/').pop()?.replace('_', ' ')})</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>

          {date && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Scheduled for:</p>
              <p className="text-sm text-muted-foreground">{getPreviewTime()}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!isValid || isPending}
          >
            {isPending ? "Scheduling..." : `Schedule ${emailCount} Email${emailCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
