import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Hotel } from "@/hooks/useHotels";
import { Activity } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface TourOperationsReportProps {
  hotels: Hotel[];
  activities: Activity[];
}

const formatTime = (time: string | null) => {
  if (!time) return '-';
  // Handle HH:MM:SS format
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

export const TourOperationsReport = ({ hotels, activities }: TourOperationsReportProps) => {
  // Sort activities by date then time
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

  return (
    <div className="space-y-8">
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
                {hotels.map(hotel => (
                  <TableRow key={hotel.id}>
                    <TableCell className="font-medium">{hotel.name}</TableCell>
                    <TableCell>{hotel.address || '-'}</TableCell>
                    <TableCell>{hotel.default_check_in ? formatDateToDDMMYYYY(hotel.default_check_in) : '-'}</TableCell>
                    <TableCell>{hotel.default_check_out ? formatDateToDDMMYYYY(hotel.default_check_out) : '-'}</TableCell>
                    <TableCell>{hotel.default_room_type || '-'}</TableCell>
                    <TableCell>{hotel.rooms_reserved ?? '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{hotel.operations_notes || '-'}</TableCell>
                  </TableRow>
                ))}
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
                  <TableHead className="font-semibold">Depart Time</TableHead>
                  <TableHead className="font-semibold">End Time</TableHead>
                  <TableHead className="font-semibold">Transport Mode</TableHead>
                  <TableHead className="font-semibold">Hospitality Inclusions</TableHead>
                  <TableHead className="font-semibold">Activity Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActivities.map(activity => (
                  <TableRow key={activity.id}>
                    <TableCell className="whitespace-nowrap">
                      {activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{activity.name}</TableCell>
                    <TableCell>{formatTime(activity.depart_for_activity)}</TableCell>
                    <TableCell>{formatTime(activity.end_time)}</TableCell>
                    <TableCell>
                      {activity.transport_mode ? (
                        <Badge variant="outline" className="capitalize">{activity.transport_mode}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <div className="whitespace-pre-wrap text-sm">{activity.hospitality_inclusions || '-'}</div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <div className="whitespace-pre-wrap text-sm">{activity.notes || '-'}</div>
                    </TableCell>
                  </TableRow>
                ))}
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
