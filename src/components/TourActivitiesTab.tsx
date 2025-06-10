
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface TourActivitiesTabProps {
  tourId: string;
  onAddActivity: () => void;
  onEditActivity: (activity: any) => void;
}

export const TourActivitiesTab = ({ tourId, onAddActivity, onEditActivity }: TourActivitiesTabProps) => {
  const { data: activities } = useActivities(tourId);

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Activities</h3>
        <Button 
          onClick={onAddActivity}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Add Activity
        </Button>
      </div>

      {activities && activities.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Spots Booked</TableHead>
                <TableHead>Pax Attending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{activity.name}</TableCell>
                  <TableCell>{activity.location || '-'}</TableCell>
                  <TableCell>
                    {activity.activity_date 
                      ? formatDateToDDMMYYYY(activity.activity_date)
                      : 'TBD'
                    }
                  </TableCell>
                  <TableCell>
                    {activity.start_time ? formatTime(activity.start_time) : '-'}
                  </TableCell>
                  <TableCell>{activity.spots_booked || 0}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {activity.spots_booked || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={activity.activity_status === 'confirmed' ? 'default' : 'secondary'}>
                      {activity.activity_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditActivity(activity)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No activities added yet.</p>
          <Button 
            onClick={onAddActivity} 
            className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Add First Activity
          </Button>
        </div>
      )}
    </div>
  );
};
