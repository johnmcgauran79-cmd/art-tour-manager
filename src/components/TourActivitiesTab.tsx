
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Printer, Mail, Bell } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { ActivityPassengerListModal } from "./ActivityPassengerListModal";
import { EmailActivityPassengerListModal } from "./EmailActivityPassengerListModal";
import { useAuth } from "@/hooks/useAuth";
import { useTabAlerts } from "@/hooks/useTabAlerts";
import { TourAlert } from "@/hooks/useTourAlerts";

interface TourActivitiesTabProps {
  tourId: string;
  alerts: TourAlert[];
  onAddActivity: () => void;
  onEditActivity: (activity: any) => void;
}

export const TourActivitiesTab = ({ tourId, alerts, onAddActivity, onEditActivity }: TourActivitiesTabProps) => {
  console.log('TourActivitiesTab rendered with tourId:', tourId);
  
  const { data: activities, isLoading, error, refetch } = useActivities(tourId);
  const [paxAttendingData, setPaxAttendingData] = useState<Record<string, number>>({});
  const [selectedActivityForPrint, setSelectedActivityForPrint] = useState<any>(null);
  const [selectedActivityForEmail, setSelectedActivityForEmail] = useState<any>(null);
  const { userRole } = useAuth();
  const { count: alertCount, criticalCount } = useTabAlerts(alerts, "activities");
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  // Log activities data
  console.log('Activities data in tab:', {
    activities: activities?.length || 0,
    isLoading,
    error: error?.message,
    tourId
  });

  // Activities are already sorted by date in the useActivities hook
  const sortedActivities = activities || [];

  useEffect(() => {
    if (sortedActivities && sortedActivities.length > 0) {
      fetchPaxAttendingForActivities();
    }
  }, [sortedActivities]);

  const fetchPaxAttendingForActivities = async () => {
    if (!sortedActivities) return;

    console.log('Fetching pax attending for activities:', sortedActivities.map(a => ({ id: a.id, name: a.name })));
    
    const activityIds = sortedActivities.map(activity => activity.id);
    
    // Get activity bookings for these activities with confirmed bookings only (exclude cancelled)
    const { data, error } = await supabase
      .from('activity_bookings')
      .select(`
        activity_id,
        passengers_attending,
        bookings!inner(id, status)
      `)
      .in('activity_id', activityIds)
      .not('bookings.status', 'eq', 'cancelled');

    if (error) {
      console.error('Error fetching activity bookings:', error);
      return;
    }

    console.log('Activity bookings data:', data);

    // Group by activity_id and sum passengers_attending
    const paxData: Record<string, number> = {};
    
    // Initialize all activities with 0
    activityIds.forEach(id => {
      paxData[id] = 0;
    });

    data?.forEach(booking => {
      const activityId = booking.activity_id;
      const passengers = booking.passengers_attending || 0;
      
      console.log(`Activity ${activityId}: Adding ${passengers} passengers`);
      paxData[activityId] += passengers;
    });

    console.log('Final calculated pax data:', paxData);
    setPaxAttendingData(paxData);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading activities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading activities: {error.message}</p>
        <Button 
          onClick={() => refetch()} 
          className="mt-4"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Activities</h3>
          {alertCount > 0 && (
            <div className="relative">
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive' : 'text-yellow-600'}`} />
              <Badge 
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {alertCount}
              </Badge>
            </div>
          )}
        </div>
        {!isAgent && (
          <Button 
            onClick={onAddActivity}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            Add Activity
          </Button>
        )}
      </div>

      {sortedActivities && sortedActivities.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Spots Available</TableHead>
                <TableHead>Pax Attending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedActivities.map((activity) => (
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
                  <TableCell>{activity.spots_available || 0}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {paxAttendingData[activity.id] || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={activity.activity_status === 'confirmed' ? 'default' : 'secondary'}>
                      {activity.activity_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditActivity(activity)}
                        title="Edit Activity"
                        disabled={isAgent}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedActivityForPrint(activity)}
                        title="Print Passenger List"
                        disabled={isAgent}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedActivityForEmail(activity)}
                        title="Email Passenger List"
                        disabled={isAgent}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
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
            className="mt-4 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            Add First Activity
          </Button>
        </div>
      )}

      {selectedActivityForPrint && (
        <ActivityPassengerListModal
          open={!!selectedActivityForPrint}
          onOpenChange={(open) => !open && setSelectedActivityForPrint(null)}
          activityId={selectedActivityForPrint.id}
          activityName={selectedActivityForPrint.name}
          activityDate={selectedActivityForPrint.activity_date 
            ? formatDateToDDMMYYYY(selectedActivityForPrint.activity_date) 
            : undefined
          }
        />
      )}

      {selectedActivityForEmail && (
        <EmailActivityPassengerListModal
          open={!!selectedActivityForEmail}
          onOpenChange={(open) => !open && setSelectedActivityForEmail(null)}
          activityId={selectedActivityForEmail.id}
          activityName={selectedActivityForEmail.name}
          activityDate={selectedActivityForEmail.activity_date 
            ? formatDateToDDMMYYYY(selectedActivityForEmail.activity_date) 
            : undefined
          }
          defaultToEmail={selectedActivityForEmail.guide_email || ""}
        />
      )}
    </div>
  );
};
