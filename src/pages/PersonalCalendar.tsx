import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Map as MapIcon, Plane, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
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
  StaffLeave,
  staffDisplayName,
} from "@/hooks/useStaffLeave";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarView = "week" | "month" | "3month" | "year";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "3month", label: "3 Months" },
  { value: "year", label: "Year" },
];

// Split a flat day list into weeks of 7 for spanning bars.
function chunkWeeks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 7) out.push(arr.slice(i, i + 7));
  return out;
}

const PersonalCalendar = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<PersonalEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<StaffLeave | null>(null);
  const [filters, setFilters] = useState({
    events: true,
    tasks: true,
    tours: true,
    leave: true,
  });
  const toggleFilter = (key: keyof typeof filters) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  const { data: events = [] } = usePersonalEvents();
  const { data: tasks = [] } = useMyTasks();
  const { data: tours = [] } = useTours();
  const { data: leave = [] } = useStaffLeave();
  const { data: staff = [] } = useStaffMembers();

  const staffById = useMemo(() => {
    const m = new Map<string, (typeof staff)[number]>();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  const leaveLabel = (l: { user_id: string; description: string }) =>
    `${staffDisplayName(staffById.get(l.user_id))} - ${l.description}`;

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.due_date && !["completed", "cancelled", "archived"].includes(t.status)
      ),
    [tasks]
  );

  const visibleTours = useMemo(
    () => tours.filter((t) => t.start_date && t.end_date && t.status !== "cancelled"),
    [tours]
  );

  // The date range currently shown — drives navigation labels and count badges.
  const range = useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(cursor, { weekStartsOn: 1 }),
        end: endOfWeek(cursor, { weekStartsOn: 1 }),
      };
    }
    if (view === "year") {
      return { start: startOfYear(cursor), end: endOfYear(cursor) };
    }
    if (view === "3month") {
      return { start: startOfMonth(cursor), end: endOfMonth(addMonths(cursor, 2)) };
    }
    return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
  }, [cursor, view]);

  const overlapsRange = (s: string, e: string) => {
    try {
      const a = parseISO(s);
      const b = parseISO(e);
      return a <= range.end && b >= range.start;
    } catch {
      return false;
    }
  };

  const counts = useMemo(
    () => ({
      events: events.filter((e) => {
        try {
          return isWithinInterval(parseISO(e.starts_at), range);
        } catch {
          return false;
        }
      }).length,
      tasks: activeTasks.filter((t) => {
        try {
          return isWithinInterval(parseISO(t.due_date!), range);
        } catch {
          return false;
        }
      }).length,
      tours: visibleTours.filter((t) => overlapsRange(t.start_date!, t.end_date!)).length,
      leave: leave.filter((l) => overlapsRange(l.start_date, l.end_date)).length,
    }),
    [events, activeTasks, visibleTours, leave, range]
  );

  const eventsForDay = (day: Date) =>
    filters.events ? events.filter((e) => isSameDay(parseISO(e.starts_at), day)) : [];

  const tasksForDay = (day: Date) =>
    !filters.tasks ? [] : activeTasks.filter((t) => isSameDay(parseISO(t.due_date!), day));

  const toursForDay = (day: Date) =>
    !filters.tours
      ? []
      : visibleTours.filter((t) => {
          try {
            return isWithinInterval(day, { start: parseISO(t.start_date!), end: parseISO(t.end_date!) });
          } catch {
            return false;
          }
        });

  const leaveForDay = (day: Date) =>
    !filters.leave
      ? []
      : leave.filter((l) => {
          try {
            return isWithinInterval(day, { start: parseISO(l.start_date), end: parseISO(l.end_date) });
          } catch {
            return false;
          }
        });

  // Build spanning segments (with stacking lanes) for a single week row.
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

    if (filters.tours)
      visibleTours.forEach((t) => {
        try {
          const s = parseISO(t.start_date!);
          const e = parseISO(t.end_date!);
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

    if (filters.leave)
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
              onClick: () => openEditLeave(l),
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

  const openEditLeave = (l: StaffLeave) => {
    setEditLeave(l);
    setDefaultDate(undefined);
    setLeaveDialogOpen(true);
  };

  const openAddLeave = () => {
    setEditLeave(null);
    setDefaultDate(undefined);
    setLeaveDialogOpen(true);
  };

  // Navigation steps by the active view unit.
  const goPrev = () =>
    setCursor((c) =>
      view === "week" ? subWeeks(c, 1) : view === "year" ? subYears(c, 1) : subMonths(c, view === "3month" ? 3 : 1)
    );
  const goNext = () =>
    setCursor((c) =>
      view === "week" ? addWeeks(c, 1) : view === "year" ? addYears(c, 1) : addMonths(c, view === "3month" ? 3 : 1)
    );

  const periodLabel = useMemo(() => {
    if (view === "week") {
      const sameMonth = isSameMonth(range.start, range.end);
      return sameMonth
        ? `${format(range.start, "d")} – ${format(range.end, "d MMM yyyy")}`
        : `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`;
    }
    if (view === "year") return format(cursor, "yyyy");
    if (view === "3month") return `${format(range.start, "MMM")} – ${format(range.end, "MMM yyyy")}`;
    return format(cursor, "MMMM yyyy");
  }, [view, range, cursor]);

  // ---- Full grid renderer (week / month / 3-month) ----
  const renderWeekRow = (week: Date[], monthContext: Date, wi: number) => {
    const segments = segmentsForWeek(week);
    const laneCount = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0);
    return (
      <div key={wi} className="relative border-b last:border-b-0">
        <div className="grid grid-cols-7">
          {week.map((day) => {
            const inMonth = view === "week" || isSameMonth(day, monthContext);
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
  };

  const renderMonthGrid = (monthDate: Date, showTitle: boolean) => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const weeks = chunkWeeks(eachDayOfInterval({ start, end }));
    return (
      <Card key={monthDate.toISOString()} className="overflow-hidden">
        {showTitle && (
          <div className="px-3 py-2 border-b bg-muted/40 text-sm font-semibold">
            {format(monthDate, "MMMM yyyy")}
          </div>
        )}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
        </div>
        <div>{weeks.map((week, wi) => renderWeekRow(week, monthDate, wi))}</div>
      </Card>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    const week = eachDayOfInterval({ start, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    return (
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {week.map((d) => (
            <div key={d.toISOString()} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
              {format(d, "EEE d")}
            </div>
          ))}
        </div>
        <div>{renderWeekRow(week, cursor, 0)}</div>
      </Card>
    );
  };

  // ---- Compact year view: 12 mini month grids with colour dots ----
  const dotColors = (day: Date) => {
    const out: string[] = [];
    if (toursForDay(day).length) out.push(getTourColor(toursForDay(day)[0].id).border);
    if (eventsForDay(day).length) out.push(eventsForDay(day)[0].color);
    if (tasksForDay(day).length) out.push(TASK_COLOR.border);
    if (leaveForDay(day).length) out.push(LEAVE_COLOR.border);
    return out.slice(0, 4);
  };

  const renderMiniMonth = (monthDate: Date) => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const monthDays = eachDayOfInterval({ start, end });
    return (
      <Card key={monthDate.toISOString()} className="p-2">
        <button
          onClick={() => { setCursor(monthDate); setView("month"); }}
          className="text-sm font-semibold mb-1.5 hover:text-primary w-full text-left"
        >
          {format(monthDate, "MMMM")}
        </button>
        <div className="grid grid-cols-7 gap-px text-[9px] text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center">{d[0]}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px mt-0.5">
          {monthDays.map((day) => {
            const inMonth = isSameMonth(day, monthDate);
            const today = isSameDay(day, new Date());
            const dots = dotColors(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => { setCursor(day); setView("week"); }}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded text-[10px] hover:bg-muted/60",
                  !inMonth && "text-muted-foreground/40",
                  today && "bg-primary text-primary-foreground font-semibold"
                )}
              >
                <span>{format(day, "d")}</span>
                <span className="flex gap-px h-1 mt-px">
                  {dots.map((c, i) => (
                    <span key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  };

  const renderDesktop = () => {
    if (view === "week") return renderWeekView();
    if (view === "month") return renderMonthGrid(cursor, false);
    if (view === "3month")
      return (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => renderMonthGrid(addMonths(startOfMonth(cursor), i), true))}
        </div>
      );
    // year
    const months = eachDayOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) })
      .filter((d) => d.getDate() === 1)
      .map((d) => startOfMonth(d));
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((m) => renderMiniMonth(m))}
      </div>
    );
  };

  // Mobile agenda days for the current month.
  const agendaDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }),
    [cursor]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold">My Calendar</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-36 text-center">{periodLabel}</span>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="outline" onClick={openAddLeave}>
            <Plane className="h-4 w-4 mr-2" /> Add Leave
          </Button>
          <Button onClick={() => openCreate(new Date())}>
            <Plus className="h-4 w-4 mr-2" /> Event
          </Button>
        </div>
      </div>

      {/* Legend — what each colour/icon means */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Events
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: TASK_COLOR.bg, border: `1px solid ${TASK_COLOR.border}` }}
          />
          Tasks
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getTourColor("sample").bg, border: `1px solid ${getTourColor("sample").border}` }}
          />
          Tours (each tour has its own colour)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: LEAVE_COLOR.bg, border: `1px solid ${LEAVE_COLOR.border}` }}
          />
          Staff Leave
        </span>
      </div>

      {/* View toggle + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {!isMobile && (
          <div className="flex items-center gap-1 border rounded-lg p-1">
            {VIEW_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={view === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setView(opt.value)}
                className="px-3"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Show:</span>
          <Toggle size="sm" pressed={filters.events} onPressedChange={() => toggleFilter("events")} className="h-7 gap-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Events
            <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{counts.events}</span>
          </Toggle>
          <Toggle size="sm" pressed={filters.tasks} onPressedChange={() => toggleFilter("tasks")} className="h-7 gap-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <CheckSquare className="h-3 w-3" /> Tasks
            <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{counts.tasks}</span>
          </Toggle>
          <Toggle size="sm" pressed={filters.tours} onPressedChange={() => toggleFilter("tours")} className="h-7 gap-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <MapIcon className="h-3 w-3" /> Tours
            <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{counts.tours}</span>
          </Toggle>
          <Toggle size="sm" pressed={filters.leave} onPressedChange={() => toggleFilter("leave")} className="h-7 gap-1 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Plane className="h-3 w-3" /> Leave
            <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{counts.leave}</span>
          </Toggle>
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {agendaDays.map((day) => {
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
                    <span className={cn("text-sm font-semibold", today && "text-primary")}>
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
                    <button
                      key={`leave-${l.id}`}
                      onClick={() => openEditLeave(l)}
                      className="w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 border-l-4"
                      style={{ backgroundColor: LEAVE_COLOR.bg, color: LEAVE_COLOR.text, borderColor: LEAVE_COLOR.border }}
                    >
                      <Plane className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1">{leaveLabel(l)}</span>
                    </button>
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
          {agendaDays.every(
            (day) => eventsForDay(day).length + tasksForDay(day).length + toursForDay(day).length + leaveForDay(day).length === 0
          ) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nothing scheduled this month.
            </p>
          )}
        </div>
      ) : (
        renderDesktop()
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editEvent}
        defaultDate={defaultDate}
      />

      <LeaveDialog
        open={leaveDialogOpen}
        onOpenChange={(o) => { setLeaveDialogOpen(o); if (!o) setEditLeave(null); }}
        defaultDate={defaultDate}
        leave={editLeave}
      />
    </div>
  );
};

export default PersonalCalendar;