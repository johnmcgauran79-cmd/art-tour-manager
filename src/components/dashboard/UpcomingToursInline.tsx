import { useTours } from "@/hooks/useTours";
import { isAfter, parseISO, startOfDay } from "date-fns";
import { Link } from "react-router-dom";

export const UpcomingToursInline = () => {
  const { data: tours } = useTours();
  if (!tours) return null;

  const excluded = ["cancelled", "past", "archived"];
  const now = new Date();
  const todayStart = startOfDay(now);

  const upcoming = tours
    .filter((t) => !excluded.includes(t.status) && isAfter(parseISO(t.start_date), now))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 2);

  if (upcoming.length === 0) return null;

  const parts = upcoming.map((t, i) => {
    const days = Math.ceil(
      (startOfDay(parseISO(t.start_date)).getTime() - todayStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return (
      <span key={t.id}>
        {i > 0 && <span className="text-muted-foreground">, then </span>}
        <Link
          to={`/tours/${t.id}`}
          className="font-semibold text-brand-navy hover:text-brand-yellow hover:underline"
        >
          {t.name}
        </Link>
        <span className="text-muted-foreground"> in </span>
        <span className="font-semibold text-brand-navy">
          {days} day{days !== 1 ? "s" : ""}
        </span>
      </span>
    );
  });

  return (
    <div className="hidden md:flex flex-1 items-center pl-6 text-sm text-muted-foreground min-w-0 truncate">
      {parts}
    </div>
  );
};