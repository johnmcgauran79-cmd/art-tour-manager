import { useTours } from "@/hooks/useTours";
import { differenceInDays, isAfter, parseISO } from "date-fns";

export const NextTourCountdown = () => {
  const { data: tours, isLoading } = useTours();

  if (isLoading || !tours) {
    return null;
  }

  // Find the next upcoming tour
  const today = new Date();
  const upcomingTours = tours
    .filter(tour => isAfter(parseISO(tour.start_date), today))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const nextTour = upcomingTours[0];

  if (!nextTour) {
    return (
      <div className="text-xs text-brand-yellow/80 mt-2">
        No upcoming tours scheduled
      </div>
    );
  }

  const daysUntilStart = differenceInDays(parseISO(nextTour.start_date), today);
  
  return (
    <div className="text-xs text-brand-yellow/80 mt-2">
      <span className="font-medium">{nextTour.name}</span> starts in{" "}
      <span className="font-medium text-brand-yellow">
        {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
      </span>
    </div>
  );
};