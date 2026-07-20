import { useState, useEffect } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { useTours } from "@/hooks/useTours";
import { isAfter, parseISO, isWithinInterval, startOfDay, isSameDay } from "date-fns";
import { useStaffLeave, useStaffMembers, staffDisplayName } from "@/hooks/useStaffLeave";

const DEFAULT_TIMEZONES = [
  { code: "DRW", timezone: "Australia/Darwin" },
  { code: "BRIS", timezone: "Australia/Brisbane" },
  { code: "LON", timezone: "Europe/London" },
  { code: "HK", timezone: "Asia/Hong_Kong" },
  { code: "TKY", timezone: "Asia/Tokyo" },
];
const MELBOURNE = { code: "MEL", timezone: "Australia/Melbourne" };
const STORAGE_KEY = "dashboard-timezones";

export const SecondaryContextBar = () => {
  const [now, setNow] = useState(new Date());
  const [timezones, setTimezones] = useState<{ code: string; timezone: string }[]>([
    MELBOURNE,
    ...DEFAULT_TIMEZONES,
  ]);
  const { data: settings } = useGeneralSettings();
  const defaultTimezone =
    (settings?.find((s) => s.setting_key === "display_timezone")?.setting_value as string) ||
    "Australia/Melbourne";
  const { data: tours } = useTours();
  const { data: leave } = useStaffLeave();
  const { data: staff } = useStaffMembers();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setTimezones([MELBOURNE, ...JSON.parse(saved)]);
        } catch {}
      }
    };
    load();
    window.addEventListener("timezones-updated", load);
    return () => window.removeEventListener("timezones-updated", load);
  }, []);

  // Next / active tour
  let tourNote: React.ReactNode = null;
  if (tours) {
    const excluded = ["cancelled", "past", "archived"];
    const active = tours.find(
      (t) =>
        !excluded.includes(t.status) &&
        isWithinInterval(now, {
          start: parseISO(t.start_date),
          end: parseISO(t.end_date),
        }),
    );
    const next = tours
      .filter((t) => !excluded.includes(t.status) && isAfter(parseISO(t.start_date), now))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
    if (active) {
      tourNote = (
        <span>
          <span className="font-semibold text-brand-yellow">{active.name}</span> in progress
        </span>
      );
    } else if (next) {
      const days = Math.ceil(
        (startOfDay(parseISO(next.start_date)).getTime() - startOfDay(now).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      tourNote = (
        <span>
          <span className="font-semibold text-brand-yellow">{next.name}</span> in {days} day
          {days !== 1 ? "s" : ""}
        </span>
      );
    }
  }

  // Active leave
  const leaveItems: React.ReactNode[] = [];
  if (leave && staff) {
    const today = startOfDay(now);
    const staffById = new Map(staff.map((s) => [s.id, s]));
    for (const l of leave) {
      const start = startOfDay(parseISO(l.start_date));
      const end = startOfDay(parseISO(l.end_date));
      if (isWithinInterval(today, { start, end })) {
        const name = staffDisplayName(staffById.get(l.user_id));
        const suffix = isSameDay(end, today)
          ? "on leave today"
          : `on leave till ${format(end, "EEE d/M/yy")}`;
        leaveItems.push(
          <span key={l.id}>
            <span className="font-semibold text-brand-yellow">{name}</span> {suffix}
          </span>,
        );
      }
    }
  }

  return (
    <div className="shrink-0 border-b border-border/60 bg-brand-navy/95 text-white/85">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1 px-3 sm:px-6 py-1.5 text-xs">
        <span className="font-medium text-white">{format(now, "EEEE d MMMM yyyy")}</span>
        <div className="flex flex-wrap items-center gap-x-3 text-brand-yellow">
          {timezones.map((tz) => (
            <span key={tz.code} className={tz.timezone === defaultTimezone ? "font-bold" : ""}>
              {tz.code} {formatInTimeZone(now, tz.timezone, "HH:mm")}
            </span>
          ))}
        </div>
        {tourNote && <span className="text-white/80">{tourNote}</span>}
        {leaveItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 text-white/80">
            {leaveItems.map((el, i) => (
              <span key={i}>{el}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};