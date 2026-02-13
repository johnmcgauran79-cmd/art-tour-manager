import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, MapPin, Users } from "lucide-react";

interface PickupLocationReportProps {
  tourId: string;
}

interface PickupOption {
  id: string;
  name: string;
  pickup_time: string | null;
  details: string | null;
}

interface PassengerEntry {
  bookingId: string;
  passengerName: string;
  groupName: string | null;
  passengerCount: number;
}

interface LocationGroup {
  option: PickupOption;
  passengers: PassengerEntry[];
  totalPax: number;
}

export const usePickupReportData = (tourId: string) => {
  return useQuery({
    queryKey: ['pickup-location-report', tourId],
    queryFn: async () => {
      // Fetch pickup options for this tour
      const { data: options, error: optionsError } = await supabase
        .from('tour_pickup_options')
        .select('id, name, pickup_time, details')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true });

      if (optionsError) throw optionsError;

      // Fetch all active bookings for this tour with their pickup selections
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          passenger_count,
          group_name,
          selected_pickup_option_id,
          lead_passenger:customers!bookings_lead_passenger_id_fkey(first_name, last_name),
          passenger_2:customers!bookings_passenger_2_id_fkey(first_name, last_name),
          passenger_3:customers!bookings_passenger_3_id_fkey(first_name, last_name),
          passenger_2_name
        `)
        .eq('tour_id', tourId)
        .not('status', 'in', '("cancelled","waitlisted")');

      if (bookingsError) throw bookingsError;

      // Group bookings by pickup option
      const locationGroups: LocationGroup[] = (options || []).map(option => {
        const matchingBookings = (bookings || []).filter(b => b.selected_pickup_option_id === option.id);
        const passengers: PassengerEntry[] = [];

        matchingBookings.forEach(booking => {
          const leadName = booking.lead_passenger
            ? `${(booking.lead_passenger as any).first_name} ${(booking.lead_passenger as any).last_name}`
            : 'Unknown';

          // Add lead passenger
          passengers.push({
            bookingId: booking.id,
            passengerName: leadName,
            groupName: booking.group_name,
            passengerCount: booking.passenger_count,
          });

          // Add passenger 2
          if (booking.passenger_2) {
            passengers.push({
              bookingId: booking.id,
              passengerName: `${(booking.passenger_2 as any).first_name} ${(booking.passenger_2 as any).last_name}`,
              groupName: booking.group_name,
              passengerCount: booking.passenger_count,
            });
          } else if (booking.passenger_2_name) {
            passengers.push({
              bookingId: booking.id,
              passengerName: booking.passenger_2_name,
              groupName: booking.group_name,
              passengerCount: booking.passenger_count,
            });
          }

          // Add passenger 3
          if (booking.passenger_3) {
            passengers.push({
              bookingId: booking.id,
              passengerName: `${(booking.passenger_3 as any).first_name} ${(booking.passenger_3 as any).last_name}`,
              groupName: booking.group_name,
              passengerCount: booking.passenger_count,
            });
          }
        });

        return {
          option,
          passengers,
          totalPax: passengers.length,
        };
      });

      // Count bookings with no pickup selected
      const pendingBookings = (bookings || []).filter(b => !b.selected_pickup_option_id);
      const pendingCount = pendingBookings.length;

      // Build pending passenger list
      const pendingPassengers: PassengerEntry[] = [];
      pendingBookings.forEach(booking => {
        const leadName = booking.lead_passenger
          ? `${(booking.lead_passenger as any).first_name} ${(booking.lead_passenger as any).last_name}`
          : 'Unknown';
        pendingPassengers.push({
          bookingId: booking.id,
          passengerName: leadName,
          groupName: booking.group_name,
          passengerCount: booking.passenger_count,
        });
      });

      return {
        locationGroups,
        pendingCount,
        pendingPassengers,
        totalBookings: (bookings || []).length,
      };
    },
    enabled: !!tourId,
  });
};

export const PickupLocationReport = ({ tourId }: PickupLocationReportProps) => {
  const { data, isLoading } = usePickupReportData(tourId);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading pickup location data...</div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">No data available.</div>;
  }

  const { locationGroups, pendingCount, pendingPassengers } = data;

  return (
    <div className="space-y-4">
      {/* Pending summary */}
      {pendingCount > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" />
              <span className="font-semibold text-sm">
                {pendingCount} booking{pendingCount !== 1 ? 's' : ''} yet to update pickup location
              </span>
            </div>
            <div className="space-y-1">
              {pendingPassengers.map((p, i) => (
                <div key={`pending-${i}`} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>• {p.passengerName}</span>
                  {p.groupName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {p.groupName}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingCount === 0 && (
        <Card className="border-success bg-success/10">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-success-foreground">
              ✓ All bookings have selected a pickup location
            </p>
          </CardContent>
        </Card>
      )}

      {/* Location groups */}
      {locationGroups.map((group) => (
        <Card key={group.option.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{group.option.name}</span>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {group.totalPax} pax
              </Badge>
            </div>

            {group.option.pickup_time && (
              <p className="text-xs text-muted-foreground mb-2">
                Pickup time: {group.option.pickup_time}
              </p>
            )}

            {group.totalPax === 0 ? (
              <p className="text-sm text-muted-foreground italic">No passengers at this location</p>
            ) : (
              <div className="space-y-1">
                {group.passengers.map((p, i) => (
                  <div key={`${group.option.id}-${i}`} className="text-sm flex items-center gap-2">
                    <span>{p.passengerName}</span>
                    {p.groupName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {p.groupName}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
