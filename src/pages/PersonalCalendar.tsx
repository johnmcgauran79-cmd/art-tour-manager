import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EventDialog } from "@/components/calendar/EventDialog";
import { usePersonalEvents, PersonalEvent } from "@/hooks/usePersonalEvents";
import { useMyTasks } from "@/hooks/useTaskQueries";
import { useTours } from "@/hooks/useTours";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PersonalCalendar = () => {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<PersonalEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const { data: events = [] } = usePersonalEvents();
  const { data: tasks = [] } = useMyTasks();
  const { data: tours = [] } = useTours();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.starts_at), day));

  const tasksForDay = (day: Date) =>
    tasks.filter(
      (t) =>
        t.due_date &&
        !["completed", "cancelled", "archived"].includes(t.status) &&
        isSameDay(parseISO(t.due_date), day)
    );

  const toursForDay = (day: Date) =>
    tours.filter((t) => {
      if (!t.start_date || !t.end_date) return false;
      if (t.status === "archived") return false;
      try {
        return isWithinInterval(day, { start: parseISO(t.start_date), end: parseISO(t.end_date) });
      } catch {
        return false;
      }
    });

  const openCreate = (day: Date) => {
    setEditEvent(null);
    setDefaultDate(format(day, "yyyy-MM-dd"));
    setDialogOpen(true);
  };

  const openEdit = (e: PersonalEvent) => {
    setEditEvent(e);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold">My Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium w-36 text-center">{format(cursor, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button onClick={() => openCreate(new Date())}>
            <Plus className="h-4 w-4 mr-2" /> Event
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Personal event</span>
        <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Task due</span>
        <span className="flex items-center gap-1"><Map className="h-3 w-3" /> Tour</span>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const dayTasks = tasksForDay(day);
            const dayTours = toursForDay(day);
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                onClick={() => openCreate(day)}
                className={cn(
                  "min-h-[96px] border-b border-r p-1.5 space-y-1 cursor-pointer hover:bg-muted/40 transition-colors",
                  !inMonth && "bg-muted/20 text-muted-foreground"
                )}
              >
                <div className="flex justify-end">
                  <span
                    className={cn(
                      "text-xs h-5 w-5 flex items-center justify-center rounded-full",
                      today && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {dayTours.map((t) => (
                  <button
                    key={`tour-${t.id}`}
                    onClick={(e) => { e.stopPropagation(); navigate(`/tours/${t.id}`); }}
                    className="w-full text-left text-[10px] truncate rounded px-1 py-0.5 bg-amber-100 text-amber-900 flex items-center gap-1"
                  >
                    <Map className="h-2.5 w-2.5 shrink-0" /> {t.name}
                  </button>
                ))}
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                    className="w-full text-left text-[10px] truncate rounded px-1 py-0.5 text-white"
                    style={{ backgroundColor: ev.color }}
                  >
                    {!ev.all_day && format(parseISO(ev.starts_at), "HH:mm") + " "}{ev.title}
                  </button>
                ))}
                {dayTasks.map((t) => (
                  <button
                    key={`task-${t.id}`}
                    onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${t.id}`); }}
                    className="w-full text-left text-[10px] truncate rounded px-1 py-0.5 bg-slate-200 text-slate-800 flex items-center gap-1"
                  >
                    <CheckSquare className="h-2.5 w-2.5 shrink-0" /> {t.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editEvent}
        defaultDate={defaultDate}
      />
    </div>
  );
};

export default PersonalCalendar;