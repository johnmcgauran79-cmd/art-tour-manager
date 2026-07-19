import { useStaffLeave, useStaffMembers, staffDisplayName } from "@/hooks/useStaffLeave";
import { format, parseISO, startOfDay, isWithinInterval, isSameDay } from "date-fns";

export const StaffLeaveNotice = () => {
  const { data: leave } = useStaffLeave();
  const { data: staff } = useStaffMembers();

  if (!leave || !staff) return null;

  const today = startOfDay(new Date());
  const active = leave.filter((l) => {
    const start = startOfDay(parseISO(l.start_date));
    const end = startOfDay(parseISO(l.end_date));
    return isWithinInterval(today, { start, end });
  });

  if (active.length === 0) return null;

  const staffById = new Map(staff.map((s) => [s.id, s]));

  return (
    <div className="text-xs text-brand-yellow/80 mt-1 space-y-0.5">
      {active.map((l) => {
        const name = staffDisplayName(staffById.get(l.user_id));
        const end = startOfDay(parseISO(l.end_date));
        const suffix = isSameDay(end, today)
          ? "on leave today"
          : `on leave till ${format(end, "EEEE d/M/yy")}`;
        return (
          <div key={l.id}>
            <span className="font-bold text-brand-yellow">{name}</span> {suffix}
          </div>
        );
      })}
    </div>
  );
};