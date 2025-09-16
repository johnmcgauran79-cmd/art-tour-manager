import { useTours } from "@/hooks/useTours";
import { differenceInDays, isAfter, isBefore, parseISO, isWithinInterval } from "date-fns";

export const NextTourCountdown = () => {
  const { data: tours, isLoading } = useTours();

  if (isLoading || !tours) {
    return null;
  }

  const today = new Date();
  
  // Find tours currently in progress
  const activeTours = tours.filter(tour => {
    const startDate = parseISO(tour.start_date);
    const endDate = parseISO(tour.end_date);
    return isWithinInterval(today, { start: startDate, end: endDate });
  });

  // Find the next upcoming tour
  const upcomingTours = tours
    .filter(tour => isAfter(parseISO(tour.start_date), today))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const nextTour = upcomingTours[0];
  const activeTour = activeTours[0]; // Assuming one tour at a time

  return (
    <div className="text-xs text-brand-yellow/80 mt-2 space-y-1">
      {activeTour && (
        <div>
          <span className="font-medium text-brand-yellow">{activeTour.name}</span> is in progress
        </div>
      )}
      
      {nextTour ? (
        <div>
          <span className="font-medium">{nextTour.name}</span> starts in{" "}
          <span className="font-medium text-brand-yellow">
            {differenceInDays(parseISO(nextTour.start_date), today)} day{differenceInDays(parseISO(nextTour.start_date), today) !== 1 ? 's' : ''}
          </span>
        </div>
      ) : !activeTour && (
        <div>No upcoming tours scheduled</div>
      )}
    </div>
  );
};