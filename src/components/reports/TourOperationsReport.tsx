import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hotel } from "@/hooks/useHotels";
import { Activity } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TourOperationsReportProps {
  hotels: Hotel[];
  activities: Activity[];
  changedFields?: Set<string>;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  changeCount?: number;
  onMarkReviewed?: () => void;
  isMarkingReviewed?: boolean;
  onActivityClick?: (activity: Activity) => void;
}

const formatTime = (time: string | null) => {
  if (!time) return '-';
  const parts = time.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  return time;
};

const ChangedCell = ({ children, isChanged, className }: { children: React.ReactNode; isChanged: boolean; className?: string }) => (
  <TableCell className={cn(
    className,
    isChanged && "bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400 ring-inset"
  )}>
    {children}
  </TableCell>
);

export const TourOperationsReport = ({ 
  hotels, 
  activities, 
  changedFields = new Set(),
  reviewedAt,
  reviewerName,
  changeCount = 0,
  onMarkReviewed,
  isMarkingReviewed = false,
  onActivityClick,
}: TourOperationsReportProps) => {
  const sortedActivities = [...activities].sort((a, b) => {
    if (a.activity_date && b.activity_date) {
      const dateCompare = a.activity_date.localeCompare(b.activity_date);
      if (dateCompare !== 0) return dateCompare;
    }
    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return 0;
  });

  const isChanged = (key: string) => changedFields.has(key);

  return (
    <div className="space-y-6">
      {/* Review Status Header */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3">
          {changeCount > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {changeCount} field{changeCount !== 1 ? 's' : ''} changed since last review
                </p>
                {reviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last reviewed by <span className="font-medium">{reviewerName || 'Unknown'}</span> on{' '}
                    {format(new Date(reviewedAt), 'dd/MM/yyyy \'at\' HH:mm')}
                  </p>
                )}
              </div>
            </>
          ) : reviewedAt ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-foreground">Report reviewed — no changes</p>
                <p className="text-xs text-muted-foreground">
                  Last reviewed by <span className="font-medium">{reviewerName || 'Unknown'}</span> on{' '}
                  {format(new Date(reviewedAt), 'dd/MM/yyyy \'at\' HH:mm')}
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">This report has not been reviewed yet.</p>
            </>
          )}
        </div>
        {onMarkReviewed && (
          <Button
            onClick={onMarkReviewed}
            variant={changeCount > 0 ? "default" : "outline"}
            size="sm"
            disabled={isMarkingReviewed}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {isMarkingReviewed ? 'Saving...' : 'Mark as Reviewed'}
          </Button>
        )}
      </div>

      {/* Hotels Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          Hotel Details
          <Badge variant="secondary">{hotels.length} hotels</Badge>
        </h3>
        {hotels.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Hotel Name</TableHead>
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold">Check In</TableHead>
                  <TableHead className="font-semibold">Check Out</TableHead>
                  <TableHead className="font-semibold">Default Room Type</TableHead>
                  <TableHead className="font-semibold">Rooms Reserved</TableHead>
                  <TableHead className="font-semibold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotels.map(hotel => {
                  const key = `hotel_${hotel.id}`;
                  return (
                    <TableRow key={hotel.id}>
                      <ChangedCell isChanged={isChanged(`${key}.name`)} className="font-medium">{hotel.name}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.address`)}>{hotel.address || '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.default_check_in`)}>{hotel.default_check_in ? formatDateToDDMMYYYY(hotel.default_check_in) : '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.default_check_out`)}>{hotel.default_check_out ? formatDateToDDMMYYYY(hotel.default_check_out) : '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.default_room_type`)}>{hotel.default_room_type || '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.rooms_reserved`)}>{hotel.rooms_reserved ?? '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.operations_notes`)} className="max-w-[200px] truncate">{hotel.operations_notes || '-'}</ChangedCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hotels configured for this tour.</p>
        )}
      </div>

      {/* Activities Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          Activity Schedule
          <Badge variant="secondary">{activities.length} activities</Badge>
        </h3>
        {sortedActivities.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead className="font-semibold">Date</TableHead>
                   <TableHead className="font-semibold">Activity Name</TableHead>
                   <TableHead className="font-semibold">Location</TableHead>
                   <TableHead className="font-semibold">Status</TableHead>
                   <TableHead className="font-semibold">Depart Time</TableHead>
                   <TableHead className="font-semibold">Start Time</TableHead>
                   <TableHead className="font-semibold">End Time</TableHead>
                  <TableHead className="font-semibold">Transport Mode</TableHead>
                  <TableHead className="font-semibold">Hospitality Inclusions</TableHead>
                  <TableHead className="font-semibold">Activity Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActivities.map(activity => {
                  const key = `activity_${activity.id}`;
                  return (
                    <TableRow key={activity.id}>
                      <ChangedCell isChanged={isChanged(`${key}.activity_date`)} className="whitespace-nowrap">
                        {activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : '-'}
                      </ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.name`)} className="font-medium">{activity.name}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.location`)}>{activity.location || '-'}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.activity_status`)}>
                        <Badge variant="outline" className="capitalize">{activity.activity_status?.replace('_', ' ') || '-'}</Badge>
                      </ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.depart_for_activity`)}>{formatTime(activity.depart_for_activity)}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.start_time`)}>{formatTime(activity.start_time)}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.end_time`)}>{formatTime(activity.end_time)}</ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.transport_mode`)}>
                        {activity.transport_mode ? (
                          <Badge variant="outline" className="capitalize">{activity.transport_mode === 'train' ? 'Public Transport' : activity.transport_mode.replace(/_/g, ' ')}</Badge>
                        ) : '-'}
                      </ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.hospitality_inclusions`)} className="max-w-[250px]">
                        <div className="whitespace-pre-wrap text-sm">{activity.hospitality_inclusions || '-'}</div>
                      </ChangedCell>
                      <ChangedCell isChanged={isChanged(`${key}.notes`)} className="max-w-[250px]">
                        <div className="whitespace-pre-wrap text-sm">{activity.notes || '-'}</div>
                      </ChangedCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No activities configured for this tour.</p>
        )}
      </div>
    </div>
  );
};
