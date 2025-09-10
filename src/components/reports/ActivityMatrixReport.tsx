import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { AlertTriangle, Grid3X3 } from "lucide-react";

interface ActivityMatrixReportProps {
  data: Array<{
    activities: Array<{
      id: string;
      name: string;
      activity_date: string;
      start_time: string;
    }>;
    bookings: Array<{
      id: string;
      leadPassenger: string;
      passengerCount: number;
      groupName: string;
      status: string;
    }>;
  }>;
  onBookingClick?: (bookingId: string) => void;
}

interface BookingActivityData {
  [bookingId: string]: {
    [activityId: string]: number;
  };
}

export const ActivityMatrixReport = ({ data, onBookingClick }: ActivityMatrixReportProps) => {
  const [allActivityBookings, setAllActivityBookings] = useState<BookingActivityData>({});
  const [activityTotalBookings, setActivityTotalBookings] = useState<{[activityId: string]: number}>({});
  const [loading, setLoading] = useState(true);

  const matrixData = data[0] || { activities: [], bookings: [] };
  const { activities, bookings } = matrixData;

  // Fetch activity bookings for all bookings and calculate totals
  useEffect(() => {
    const fetchAllActivityBookings = async () => {
      try {
        const activityBookingsData: BookingActivityData = {};
        
        // Initialize with all bookings and activities
        for (const booking of bookings) {
          activityBookingsData[booking.id] = {};
          for (const activity of activities) {
            activityBookingsData[booking.id][activity.id] = 0; // Default to 0
          }
        }

        // Fetch actual activity bookings from database (for this tour only)
        const { data: activityBookings, error } = await supabase
          .from('activity_bookings')
          .select('booking_id, activity_id, passengers_attending')
          .in('booking_id', bookings.map(b => b.id))
          .in('activity_id', activities.map(a => a.id));

        if (error) {
          console.error('Error fetching activity bookings:', error);
        } else if (activityBookings) {
          // Update with actual allocation data
          activityBookings.forEach(ab => {
            if (activityBookingsData[ab.booking_id] && activityBookingsData[ab.booking_id][ab.activity_id] !== undefined) {
              activityBookingsData[ab.booking_id][ab.activity_id] = ab.passengers_attending;
            }
          });
        }

        // Calculate total bookings for each activity
        const totalBookings: {[activityId: string]: number} = {};
        activities.forEach(activity => {
          totalBookings[activity.id] = activityBookings 
            ? activityBookings
                .filter(ab => ab.activity_id === activity.id)
                .reduce((sum, ab) => sum + ab.passengers_attending, 0)
            : 0;
        });
        
        setAllActivityBookings(activityBookingsData);
        setActivityTotalBookings(totalBookings);
        setLoading(false);
      } catch (error) {
        console.error('Error in fetchAllActivityBookings:', error);
        setLoading(false);
      }
    };

    if (bookings.length > 0 && activities.length > 0) {
      fetchAllActivityBookings();
    } else {
      setLoading(false);
    }
  }, [bookings, activities]);

  // Helper function to get discrepancy status
  const getDiscrepancyStatus = (bookingPassengerCount: number, activityAllocation: number) => {
    if (activityAllocation === 0) return 'missing';
    if (activityAllocation !== bookingPassengerCount) return 'mismatch';
    return 'correct';
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'missing': return 'bg-red-100 text-red-800 border-red-200';
      case 'mismatch': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'correct': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filter bookings to only show those with discrepancies
  const bookingsWithDiscrepancies = bookings.filter(booking => {
    // Check if this booking has any discrepancies across all activities
    return activities.some(activity => {
      const allocation = allActivityBookings[booking.id]?.[activity.id] || 0;
      const status = getDiscrepancyStatus(booking.passengerCount, allocation);
      return status !== 'correct';
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading activity allocations...</div>
      </div>
    );
  }

  if (bookingsWithDiscrepancies.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="bg-green-100 p-3 rounded-full mx-auto mb-3 w-fit">
            <Grid3X3 className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-sm font-medium text-green-800 mb-1">All Activity Allocations Correct!</div>
          <div className="text-xs text-green-600">No discrepancies found - all bookings have proper activity allocations</div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">No activities found for this tour</div>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">No bookings found for this tour</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Header */}
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <div>
          <div className="font-medium text-red-800">Activity Allocation Discrepancies Found</div>
          <div className="text-sm text-red-600">
            {bookingsWithDiscrepancies.length} booking{bookingsWithDiscrepancies.length !== 1 ? 's' : ''} with different activity allocations
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium">Legend:</div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
          <span className="text-xs">Correct</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
          <span className="text-xs">Mismatch</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
          <span className="text-xs">Missing/0</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white z-10 min-w-[200px] border-r">
                Booking Details
              </TableHead>
              <TableHead className="text-center min-w-[80px]">Pax Count</TableHead>
              {activities.map((activity) => (
                <TableHead key={activity.id} className="text-center min-w-[120px]">
                  <div className="text-xs">
                    <div className="font-medium truncate" title={activity.name}>
                      {activity.name}
                    </div>
                    <div className="text-muted-foreground">
                      {formatDateToDDMMYYYY(activity.activity_date)}
                    </div>
                    <div className="text-muted-foreground font-medium">
                      Total: {activityTotalBookings[activity.id] || 0}
                    </div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookingsWithDiscrepancies.map((booking) => (
              <TableRow 
                key={booking.id} 
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onBookingClick?.(booking.id)}
                title="Click to open booking and edit activity allocations"
              >
                <TableCell className="sticky left-0 bg-white z-10 border-r hover:bg-blue-50">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{booking.leadPassenger}</div>
                    {booking.groupName && (
                      <div className="text-xs text-muted-foreground">
                        Group: {booking.groupName}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {booking.passengerCount}
                </TableCell>
                {activities.map((activity) => {
                  const allocation = allActivityBookings[booking.id]?.[activity.id] || 0;
                  const status = getDiscrepancyStatus(booking.passengerCount, allocation);
                  
                  return (
                    <TableCell key={activity.id} className="text-center">
                      <div 
                        className={`inline-flex items-center justify-center w-8 h-8 rounded border text-xs font-medium ${getStatusColor(status)}`}
                        title={`${allocation} passengers allocated${status === 'mismatch' ? ` (expected ${booking.passengerCount})` : ''}`}
                      >
                        {allocation}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="font-medium mb-1 text-yellow-800">Discrepancy Alert Summary:</div>
        <div>• This report only shows bookings with activity allocation errors</div>
        <div>• Green cells indicate correct allocation (passengers = booking count)</div>
        <div>• Yellow cells indicate mismatched allocation (different passenger count)</div>
        <div>• Red cells indicate missing or zero allocation</div>
        <div>• Review and update activity allocations for the bookings shown above</div>
      </div>
    </div>
  );
};