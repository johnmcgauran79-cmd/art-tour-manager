import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Activity } from "@/hooks/useActivities";
import { useAuth } from "@/hooks/useAuth";

interface ActivityBookingInfo {
  id: string;
  passengers_attending: number;
  booking: {
    id: string;
    passenger_count: number;
    passenger_2_name: string | null;
    passenger_3_name: string | null;
    status: string;
    lead_passenger: {
      first_name: string;
      last_name: string;
    } | null;
  };
}

interface ViewActivityModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (activity: Activity) => void;
}

export const ViewActivityModal = ({ activity, open, onOpenChange, onEdit }: ViewActivityModalProps) => {
  const [paxAttending, setPaxAttending] = useState(0);
  const [activityBookings, setActivityBookings] = useState<ActivityBookingInfo[]>([]);
  const { userRole } = useAuth();
  const isAgent = userRole === 'agent';

  useEffect(() => {
    if (activity) {
      fetchActivityData(activity.id);
    }
  }, [activity]);

  const fetchActivityData = async (activityId: string) => {
    const { data, error } = await supabase
      .from('activity_bookings')
      .select(`
        id,
        passengers_attending,
        bookings!inner(
          id,
          passenger_count,
          passenger_2_name,
          passenger_3_name,
          status,
          customers!bookings_lead_passenger_id_fkey(first_name, last_name)
        )
      `)
      .eq('activity_id', activityId)
      .gt('passengers_attending', 0)
      .neq('bookings.status', 'cancelled');

    if (error) {
      console.error('Error fetching activity bookings:', error);
      setPaxAttending(0);
      setActivityBookings([]);
    } else {
      const total = data.reduce((sum, booking) => sum + (booking.passengers_attending || 0), 0);
      setPaxAttending(total);
      
      // Transform the data
      const transformed = data.map((item: any) => ({
        id: item.id,
        passengers_attending: item.passengers_attending,
        booking: {
          id: item.bookings.id,
          passenger_count: item.bookings.passenger_count,
          passenger_2_name: item.bookings.passenger_2_name,
          passenger_3_name: item.bookings.passenger_3_name,
          status: item.bookings.status,
          lead_passenger: item.bookings.customers
        }
      }));
      
      setActivityBookings(transformed);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'finalised':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleEditClick = () => {
    if (activity) {
      onOpenChange(false);
      onEdit(activity);
    }
  };

  if (!activity) return null;

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right">{value || '-'}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{activity.name}</span>
            <Badge variant={getStatusColor(activity.activity_status || 'pending')}>
              {(activity.activity_status || 'pending').replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Basic Information</h4>
            <div className="bg-muted/30 rounded-lg p-4">
              <InfoRow label="Location" value={activity.location} />
              <InfoRow label="Date" value={activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : null} />
              <InfoRow label="Cutoff Date" value={activity.cutoff_date ? formatDateToDDMMYYYY(activity.cutoff_date) : null} />
              <InfoRow label="Start Time" value={formatTime(activity.start_time)} />
              <InfoRow label="End Time" value={formatTime(activity.end_time)} />
              <InfoRow label="Spots Available" value={activity.spots_available || 0} />
              <InfoRow label="Pax Attending" value={paxAttending} />
            </div>
          </div>

          {/* Transport Details */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Transport Details</h4>
            <div className="bg-muted/30 rounded-lg p-4">
              <InfoRow 
                label="Transport Status" 
                value={
                  <Badge variant="outline">
                    {(activity.transport_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                } 
              />
              <InfoRow label="Transport Company" value={activity.transport_company} />
              <InfoRow label="Transport Contact" value={activity.transport_contact_name} />
              <InfoRow label="Transport Phone" value={activity.transport_phone} />
              <InfoRow label="Transport Email" value={activity.transport_email} />
              <InfoRow label="Pickup Time" value={formatTime(activity.pickup_time)} />
              <InfoRow label="Pickup Location" value={activity.pickup_location} />
              <InfoRow label="Collection Time" value={formatTime(activity.collection_time)} />
              <InfoRow label="Collection Location" value={activity.collection_location} />
              <InfoRow label="Drop Off Location" value={activity.dropoff_location} />
            </div>
          </div>

          {/* Guide Details */}
          {(activity.guide_name || activity.guide_phone || activity.guide_email) && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guide Details</h4>
              <div className="bg-muted/30 rounded-lg p-4">
                <InfoRow label="Guide Name" value={activity.guide_name} />
                <InfoRow label="Guide Phone" value={activity.guide_phone} />
                <InfoRow label="Guide Email" value={activity.guide_email} />
              </div>
            </div>
          )}

          {/* Hospitality */}
          {activity.hospitality_inclusions && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hospitality Inclusions</h4>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{activity.hospitality_inclusions}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {(activity.notes || activity.operations_notes || activity.transport_notes) && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Notes</h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                {activity.notes && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">General Notes</span>
                    <p className="text-sm whitespace-pre-wrap">{activity.notes}</p>
                  </div>
                )}
                {activity.operations_notes && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Operations Notes</span>
                    <p className="text-sm whitespace-pre-wrap">{activity.operations_notes}</p>
                  </div>
                )}
                {activity.transport_notes && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Transport Notes</span>
                    <p className="text-sm whitespace-pre-wrap">{activity.transport_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings List */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Bookings ({activityBookings.length})
            </h4>
            {activityBookings.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Passenger</TableHead>
                      <TableHead>Other Passengers</TableHead>
                      <TableHead className="text-right">Pax Attending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityBookings.map((ab) => (
                      <TableRow key={ab.id}>
                        <TableCell className="font-medium">
                          {ab.booking.lead_passenger 
                            ? `${ab.booking.lead_passenger.first_name} ${ab.booking.lead_passenger.last_name}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {[ab.booking.passenger_2_name, ab.booking.passenger_3_name]
                            .filter(Boolean)
                            .join(', ') || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {ab.passengers_attending}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground text-sm">
                No bookings allocated to this activity
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          {!isAgent && (
            <Button onClick={handleEditClick} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Activity
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
