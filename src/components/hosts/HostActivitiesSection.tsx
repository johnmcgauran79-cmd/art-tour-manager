import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Users, Calendar } from "lucide-react";
import { useActivities, Activity } from "@/hooks/useActivities";
import { useActivityPassengers } from "@/hooks/useActivityPassengers";
import { format } from "date-fns";
import { HostActivityViewModal } from "./HostActivityViewModal";

interface HostActivitiesSectionProps {
  tourId: string;
}

/** Shows pax count for a single activity row */
const ActivityPaxCell = ({ activityId }: { activityId: string }) => {
  const { data } = useActivityPassengers(activityId);
  const total = data?.reduce((sum, ab) => sum + (ab.passengers_attending || 0), 0) || 0;
  return <span>{total}</span>;
};

export const HostActivitiesSection = ({ tourId }: HostActivitiesSectionProps) => {
  const { data: activities, isLoading } = useActivities(tourId);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading activities...</p>;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activities scheduled for this tour</p>
      </div>
    );
  }

  // Group activities by date
  const grouped = activities.reduce<Record<string, Activity[]>>((acc, activity) => {
    const key = activity.activity_date || 'no-date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(activity);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === 'no-date') return 1;
    if (b === 'no-date') return -1;
    return a.localeCompare(b);
  });

  const formatDayDate = (dateStr: string) => {
    if (dateStr === 'no-date') return 'Date TBD';
    try {
      return format(new Date(dateStr), 'EEEE d MMMM');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="space-y-4">
        {sortedDates.map((dateKey) => (
          <div key={dateKey}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">{formatDayDate(dateKey)}</h4>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {grouped[dateKey].map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer active:bg-muted"
                  onClick={() => setSelectedActivity(activity)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{activity.name}</p>
                      {activity.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{activity.location}</span>
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <ActivityPaxCell activityId={activity.id} />
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Pax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[dateKey].map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <TableCell className="font-medium">{activity.name}</TableCell>
                      <TableCell className="text-muted-foreground">{activity.location || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        <ActivityPaxCell activityId={activity.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      <HostActivityViewModal
        activity={selectedActivity}
        open={!!selectedActivity}
        onOpenChange={(open) => { if (!open) setSelectedActivity(null); }}
      />
    </>
  );
};
