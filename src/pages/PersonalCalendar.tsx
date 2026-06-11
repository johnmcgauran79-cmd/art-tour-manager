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
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Map as MapIcon, Plane, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EventDialog } from "@/components/calendar/EventDialog";
import { LeaveDialog } from "@/components/calendar/LeaveDialog";
import { usePersonalEvents, PersonalEvent } from "@/hooks/usePersonalEvents";
import { useMyTasks } from "@/hooks/useTaskQueries";
import { useTours } from "@/hooks/useTours";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTourColor, TASK_COLOR, LEAVE_COLOR, TourColor } from "@/lib/tourColors";
import {
  useStaffLeave,
  useStaffMembers,
  useDeleteStaffLeave,
  staffDisplayName,
} from "@/hooks/useStaffLeave";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Split the flat day list into weeks of 7 for spanning tour bars.
function chunkWeeks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 7) out.push(arr.slice(i, i + 7));
  return out;
}

const PersonalCalendar = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { userRole } = usePermissions();
  const isAdmin = userRole === "admin";
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<PersonalEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const { data: events = [] } = usePersonalEvents();
  const { data: tasks = [] } = useMyTasks();
  const { data: tours = [] } = useTours();
  const { data: leave = [] } = useStaffLeave();
  const { data: staff = [] } = useStaffMembers();
  const deleteLeave = useDeleteStaffLeave();

  const staffById = useMemo(() => {
    const m = new Map<string, (typeof staff)[number]>();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  const leaveLabel = (l: { user_id: string; description: string }) =>
    `${staffDisplayName(staffById.get(l.user_id))} - ${l.description}`;

  const canDeleteLeave = (l: { user_id: string }) => isAdmin || l.user_id === user?.id;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weeks = useMemo(() => chunkWeeks(days), [days]);

  // Days of the current month only, used for the mobile agenda/list view.
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }),
    [cursor]
  );

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
      if (t.status === "cancelled") return false;
      try {
        return isWithinInterval(day, { start: parseISO(t.start_date), end: parseISO(t.end_date) });
      } catch {
        return false;
      }
    });

  const leaveForDay = (day: Date) =>
    leave.filter((l) => {
      try {
        return isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) });
      } catch {
        return false;
      }
    });

  // Build spanning tour segments (with stacking lanes) for a single week row.
  const segmentsForWeek = (week: Date[]) => {
    type Span = {
      key: string;
      kind: "tour" | "leave";
      label: string;
      color: TourColor;
      onClick?: () => void;
      start: Date;
      end: Date;
      startCol: number;
      endCol: number;
    };

    const spans: Omit<Span, "startCol" | "endCol">[] = [];

    tours.forEach((t) => {
      if (!t.start_date || !t.end_date || t.status === "cancelled") return;
      try {
        const s = parseISO(t.start_date);
        const e = parseISO(t.end_date);
        if (week.some((d) => isWithinInterval(d, { start: s, end: e }))) {
          spans.push({
            key: `tour-${t.id}`,
            kind: "tour",
            label: t.name,
            color: getTourColor(t.id),
            onClick: () => navigate(`/tours/${t.id}`),
            start: s,
            end: e,
          });
        }
      } catch {
        /* ignore */
      }
    });

    leave.forEach((l) => {
      try {
        const s = parseISO(l.start_date);
        const e = parseISO(l.end_date);
        if (week.some((d) => isWithinInterval(d, { start: s, end: e }))) {
          spans.push({
            key: `leave-${l.id}`,
            kind: "leave",
            label: leaveLabel(l),
            color: LEAVE_COLOR,
            onClick: canDeleteLeave(l) ? () => deleteLeave.mutate(l.id) : undefined,
            start: s,
            end: e,
          });
        }
      } catch {
        /* ignore */
      }
    });

    const raw: Span[] = spans
      .map((sp) => {
        let startCol = -1;
        let endCol = -1;
        week.forEach((d, i) => {
          if (isWithinInterval(d, { start: sp.start, end: sp.end })) {
            if (startCol === -1) startCol = i;
            endCol = i;
          }
        });
        return { ...sp, startCol, endCol };
      })
      .filter((seg) => seg.startCol !== -1)
      .sort((a, b) => a.startCol - b.startCol || a.label.localeCompare(b.label));

    // Greedy lane assignment so overlapping tours stack vertically.
    const laneEnds: number[] = [];
    return raw.map((seg) => {
      let lane = laneEnds.findIndex((end) => end < seg.startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(seg.endCol);
      } else {
        laneEnds[lane] = seg.endCol;
      }
      return { ...seg, lane };
    });
  };

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
          <Button variant="outline" onClick={() => { setDefaultDate(undefined); setLeaveDialogOpen(true); }}>
            <Plane className="h-4 w-4 mr-2" /> Add Leave
          </Button>
          <Button onClick={() => openCreate(new Date())}>
            <Plus className="h-4 w-4 mr-2" /> Event
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Personal event</span>
        <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Task due</span>
        <span className="flex items-center gap-1"><MapIcon className="h-3 w-3" /> Tour</span>
        <span className="flex items-center gap-1"><Plane className="h-3 w-3" /> Staff leave</span>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {monthDays.map((day) => {
            const dayEvents = eventsForDay(day);
            const dayTasks = tasksForDay(day);
            const dayTours = toursForDay(day);
            const dayLeave = leaveForDay(day);
            const total = dayEvents.length + dayTasks.length + dayTours.length + dayLeave.length;
            if (total === 0) return null;
            const today = isSameDay(day, new Date());
            return (
              <Card key={day.toISOString()} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        today && "text-primary"
                      )}
                    >
                      {format(day, "EEE dd/MM/yyyy")}
                    </span>
                    {today && <span className="text-[10px] rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground">Today</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(day)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {dayTours.map((t) => {
                    const c = getTourColor(t.id);
                    return (
                      <button
                        key={`tour-${t.id}`}
                        onClick={() => navigate(`/tours/${t.id}`)}
                        className="w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 border-l-4"
                        style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                      >
                        <MapIcon className="h-3.5 w-3.5 shrink-0" /> {t.name}
                      </button>
                    );
                  })}
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => openEdit(ev)}
                      className="w-full text-left text-xs rounded px-2 py-1.5 text-white flex items-center gap-2"
                      style={{ backgroundColor: ev.color }}
                    >
                      <span className="shrink-0">{ev.all_day ? "All day" : format(parseISO(ev.starts_at), "HH:mm")}</span>
                      <span className="truncate">{ev.title}</span>
                    </button>
                  ))}
                  {dayLeave.map((l) => (
                    <div
                      key={`leave-${l.id}`}
                      className="w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 border-l-4"
                      style={{ backgroundColor: LEAVE_COLOR.bg, color: LEAVE_COLOR.text, borderColor: LEAVE_COLOR.border }}
                    >
                      <Plane className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1">{leaveLabel(l)}</span>
                      {canDeleteLeave(l) && (
                        <button onClick={() => deleteLeave.mutate(l.id)} aria-label="Delete leave">
                          <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        </button>
                      )}
                    </div>
                  ))}
                  {dayTasks.map((t) => {
                    const c = TASK_COLOR;
                    return (
                      <button
                        key={`task-${t.id}`}
                        onClick={() => navigate(`/tasks/${t.id}`)}
                        className="w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 border-l-4"
                        style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                      >
                        <CheckSquare className="h-3.5 w-3.5 shrink-0" /> {t.title}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {monthDays.every(
            (day) => eventsForDay(day).length + tasksForDay(day).length + toursForDay(day).length + leaveForDay(day).length === 0
          ) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nothing scheduled this month.
            </p>
          )}
        </div>
      ) : (
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
        </div>
        <div>
          {weeks.map((week, wi) => {
            const segments = segmentsForWeek(week);
            const laneCount = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0);
            return (
              <div key={wi} className="relative border-b last:border-b-0">
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {week.map((day) => {
                    const inMonth = isSameMonth(day, cursor);
                    const today = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => openCreate(day)}
                        className={cn(
                          "min-h-[110px] border-r last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/40 transition-colors",
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
                        {/* Reserve space for the spanning tour bars overlay */}
                        <div style={{ height: laneCount * 20 }} />
                        <div className="space-y-1 mt-1">
                          {eventsForDay(day).map((ev) => (
                            <button
                              key={ev.id}
                              onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                              className="w-full text-left text-[10px] truncate rounded px-1 py-0.5 text-white"
                              style={{ backgroundColor: ev.color }}
                            >
                              {!ev.all_day && format(parseISO(ev.starts_at), "HH:mm") + " "}{ev.title}
                            </button>
                          ))}
                          {tasksForDay(day).map((t) => {
                            const c = TASK_COLOR;
                            return (
                              <button
                                key={`task-${t.id}`}
                                onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${t.id}`); }}
                                className="w-full text-left text-[10px] truncate rounded px-1 py-0.5 flex items-center gap-1 border-l-2"
                                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                              >
                                <CheckSquare className="h-2.5 w-2.5 shrink-0" /> {t.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Spanning tour bars overlay */}
                <div
                  className="pointer-events-none absolute left-0 right-0 grid grid-cols-7 gap-px px-1"
                  style={{ top: 28 }}
                >
                  {segments.map((seg) => {
                    const c = seg.color;
                    const Icon = seg.kind === "leave" ? Plane : MapIcon;
                    return (
                      <button
                        key={seg.key}
                        onClick={() => seg.onClick?.()}
                        className="pointer-events-auto text-left text-[10px] truncate rounded px-1.5 h-[18px] leading-[18px] flex items-center gap-1 border-l-2"
                        style={{
                          gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                          gridRow: seg.lane + 1,
                          backgroundColor: c.bg,
                          color: c.text,
                          borderColor: c.border,
                        }}
                        title={seg.label}
                      >
                        <Icon className="h-2.5 w-2.5 shrink-0" /> {seg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editEvent}
        defaultDate={defaultDate}
      />

      <LeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        defaultDate={defaultDate}
      />
    </div>
  );
};

export default PersonalCalendar;