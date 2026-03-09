import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { Activity } from "@/hooks/useActivities";
import { ActivityAttachmentsSection } from "@/components/ActivityAttachmentsSection";
import { JourneysEditor } from "@/components/JourneysEditor";

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
      preferred_name: string | null;
    } | null;
  };
}

interface HostActivityViewModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HostActivityViewModal = ({ activity, open, onOpenChange }: HostActivityViewModalProps) => {
  const [paxAttending, setPaxAttending] = useState(0);
  const [activityBookings, setActivityBookings] = useState<ActivityBookingInfo[]>([]);

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
          customers!bookings_lead_passenger_id_fkey(first_name, last_name, preferred_name)
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

  if (!activity) return null;

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-1.5 sm:py-2 border-b border-border last:border-0 gap-2">
      <span className="text-muted-foreground text-xs sm:text-sm flex-shrink-0">{label}</span>
      <span className="text-xs sm:text-sm font-medium text-right truncate">{value || '-'}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-base sm:text-lg truncate pr-2">{activity.name}</span>
            <Badge variant="outline" className="self-start sm:self-auto text-xs">
              {(activity.activity_status || 'pending').replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Basic Information */}
          <div className="space-y-1">
            <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Basic Information</h4>
            <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
              <InfoRow label="Location" value={activity.location} />
              <InfoRow label="Date" value={activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : null} />
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Spots" value={activity.spots_available || 0} />
                <InfoRow label="Pax" value={paxAttending} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Activity Start" value={formatTime(activity.start_time)} />
                <InfoRow label="Activity End" value={formatTime(activity.end_time)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Depart for Activity" value={formatTime(activity.depart_for_activity)} />
                <InfoRow 
                  label="Transport Mode" 
                  value={activity.transport_mode === 'train' ? 'Public Transport' : activity.transport_mode ? activity.transport_mode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not Required'} 
                />
              </div>
            </div>
          </div>

          {/* Activity Notes */}
          {activity.notes && (
            <div className="space-y-1">
              <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Activity Notes</h4>
              <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
                <p className="text-xs sm:text-sm whitespace-pre-wrap">{activity.notes}</p>
              </div>
            </div>
          )}

          {/* Contact Info - only if data exists */}
          {(activity.contact_name || activity.contact_phone || activity.contact_email) && (
            <div className="space-y-1">
              <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Contact Details</h4>
              <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
                {activity.contact_name && <InfoRow label="Name" value={activity.contact_name} />}
                {activity.contact_phone && <InfoRow label="Phone" value={activity.contact_phone} />}
                {activity.contact_email && <InfoRow label="Email" value={activity.contact_email} />}
              </div>
            </div>
          )}

          {/* Dress Code */}
          {activity.dress_code && activity.dress_code !== 'not_required' && (
            <div className="space-y-1">
              <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Dress Code</h4>
              <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
                <p className="text-xs sm:text-sm font-medium">
                  {activity.dress_code === 'casual' ? 'Casual' :
                   activity.dress_code === 'smart_casual' ? 'Smart Casual' :
                   activity.dress_code === 'casual_racewear' ? 'Casual Racewear (collared shirt, no jacket or tie required)' :
                   activity.dress_code === 'members_racewear' ? 'Members Racewear (Jacket & Tie)' :
                   activity.dress_code === 'black_tie' ? 'Black Tie' :
                   activity.dress_code === 'other' ? 'Other' : activity.dress_code}
                </p>
              </div>
            </div>
          )}

          {/* Hospitality Inclusions */}
          {activity.hospitality_inclusions && (
            <div className="space-y-1">
              <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Hospitality Inclusions</h4>
              <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
                <p className="text-xs sm:text-sm whitespace-pre-wrap">{activity.hospitality_inclusions}</p>
              </div>
            </div>
          )}

          {/* Transport Details - tap to expand */}
          <details className="group">
            <summary className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider cursor-pointer list-none flex items-center gap-2">
              <span>Transport Details</span>
              <span className="text-xs text-muted-foreground/60 group-open:hidden">(tap to expand)</span>
            </summary>
            <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Company" value={activity.transport_company} />
                <InfoRow 
                  label="Status" 
                  value={
                    <Badge variant="outline" className="text-xs">
                      {(activity.transport_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  } 
                />
              </div>
              <InfoRow label="Contact" value={activity.transport_contact_name} />
              <InfoRow label="Phone" value={activity.transport_phone} />
              <InfoRow label="Email" value={activity.transport_email} />
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Driver Name" value={activity.driver_name} />
                <InfoRow label="Driver Phone" value={activity.driver_phone} />
              </div>
              {activity.transport_notes && (
                <div className="mt-2 pt-2 border-t">
                  <span className="text-xs text-muted-foreground uppercase">Transport Notes</span>
                  <p className="text-xs sm:text-sm whitespace-pre-wrap mt-1">{activity.transport_notes}</p>
                </div>
              )}
            </div>
          </details>

          {/* Journeys */}
          {activity.activity_journeys && activity.activity_journeys.length > 0 && (
            <details className="group" open>
              <summary className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider cursor-pointer list-none">
                Journeys ({activity.activity_journeys.length})
              </summary>
              <div className="mt-1">
                <JourneysEditor
                  journeys={activity.activity_journeys.map(j => ({
                    id: j.id,
                    journey_number: j.journey_number,
                    pickup_time: j.pickup_time || "",
                    pickup_location: j.pickup_location || "",
                    destination: j.destination || "",
                  }))}
                  onChange={() => {}}
                  readOnly
                />
              </div>
            </details>
          )}

          {/* Attachments */}
          <ActivityAttachmentsSection activityId={activity.id} />

          {/* Bookings List */}
          <div className="space-y-1">
            <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
              Bookings ({activityBookings.length})
            </h4>
            {activityBookings.length > 0 ? (
              <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {activityBookings.map((ab) => (
                    <div key={ab.id} className="bg-muted/30 rounded-lg p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {ab.booking.lead_passenger 
                              ? `${ab.booking.lead_passenger.first_name} ${ab.booking.lead_passenger.last_name}${ab.booking.lead_passenger.preferred_name ? ` (${ab.booking.lead_passenger.preferred_name})` : ''}`
                              : '-'}
                          </p>
                          {(ab.booking.passenger_2_name || ab.booking.passenger_3_name) && (
                            <p className="text-xs text-muted-foreground truncate">
                              +{[ab.booking.passenger_2_name, ab.booking.passenger_3_name].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {ab.passengers_attending} pax
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block border rounded-lg">
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
                              ? `${ab.booking.lead_passenger.first_name} ${ab.booking.lead_passenger.last_name}${ab.booking.lead_passenger.preferred_name ? ` (${ab.booking.lead_passenger.preferred_name})` : ''}`
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
              </>
            ) : (
              <div className="bg-muted/30 rounded-lg p-3 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">
                No bookings allocated to this activity
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
