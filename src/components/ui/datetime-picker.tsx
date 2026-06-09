import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  id?: string;
  /** Value in "yyyy-MM-dd'T'HH:mm" format (same as datetime-local). */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const VALUE_FMT = "yyyy-MM-dd'T'HH:mm";

/**
 * Date + time picker that always displays the date in Australian
 * day/month/year format (dd/MM/yyyy), regardless of browser locale.
 * Emits/consumes the same string format as a native datetime-local input.
 */
export const DateTimePicker = ({ id, value, onChange, className }: DateTimePickerProps) => {
  const [open, setOpen] = useState(false);

  const parsed = value ? parse(value, VALUE_FMT, new Date()) : undefined;
  const dateObj = parsed && isValid(parsed) ? parsed : undefined;
  const timeStr = dateObj ? format(dateObj, "HH:mm") : "00:00";

  const handleDateSelect = (date?: Date) => {
    if (!date) return;
    const [h, m] = timeStr.split(":").map(Number);
    date.setHours(h || 0, m || 0, 0, 0);
    onChange(format(date, VALUE_FMT));
    setOpen(false);
  };

  const handleTimeChange = (newTime: string) => {
    const base = dateObj ?? new Date();
    const [h, m] = newTime.split(":").map(Number);
    base.setHours(h || 0, m || 0, 0, 0);
    onChange(format(base, VALUE_FMT));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !dateObj && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateObj ? format(dateObj, "dd/MM/yyyy") : "Select date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timeStr}
        onChange={(e) => handleTimeChange(e.target.value)}
        className="w-[120px]"
      />
    </div>
  );
};
