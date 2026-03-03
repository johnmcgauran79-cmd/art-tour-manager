import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { AlertTriangle, Grid3X3, Loader2, ChevronDown, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AggregatedActivityMatrixReportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DiscrepancyData {
  tourId: string;
  tourName: string;
  tourStartDate: string;
  bookingId: string;
  leadPassenger: string;
  passengerCount: number;
  groupName: string;
  status: string;
  activityId: string;
  activityName: string;
  activityDate: string;
  allocatedCount: number;
  discrepancyType: 'missing' | 'mismatch';
}

export const AggregatedActivityMatrixReport = ({ 
  open = true, 
  onOpenChange 
}: AggregatedActivityMatrixReportProps = {}) => {
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if (open !== false) {
      fetchDiscrepancies();
    }
  }, [open]);

  const fetchDiscrepancies = async () => {
    setLoading(true);
    try {
      // Use the new optimized database function
      const { data, error } = await supabase.rpc('get_activity_allocation_discrepancies');
      
      if (error) throw error;
      
      // Map the data to our frontend structure
      const allDiscrepancies: DiscrepancyData[] = (data || []).map((row: any) => ({
        tourId: row.tour_id,
        tourName: row.tour_name,
        tourStartDate: row.tour_start_date,
        bookingId: row.booking_id,
        leadPassenger: `${row.lead_passenger_first_name || ''} ${row.lead_passenger_last_name || ''}`.trim(),
        passengerCount: row.passenger_count,
        groupName: row.group_name || '',
        status: row.status,
        activityId: row.activity_id,
        activityName: row.activity_name,
        activityDate: row.activity_date || '',
        allocatedCount: row.allocated_count,
        discrepancyType: row.discrepancy_type as 'missing' | 'mismatch'
      }));

      setDiscrepancies(allDiscrepancies);
    } catch (error) {
      console.error('Error fetching activity discrepancies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (type: 'missing' | 'mismatch') => {
    switch (type) {
      case 'missing':
        return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
      case 'mismatch':
        return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20';
    }
  };

  const handleViewBooking = (tourId: string, bookingId: string) => {
    navigate(`/bookings/${bookingId}?tab=activities`);
    if (onOpenChange) onOpenChange(false);
  };

  const toggleBooking = (bookingId: string) => {
    const newExpanded = new Set(expandedBookings);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedBookings(newExpanded);
  };

  // Group discrepancies by tour and then by booking
  const groupedByTourAndBooking = discrepancies.reduce((acc, item) => {
    if (!acc[item.tourId]) {
      acc[item.tourId] = {
        tourName: item.tourName,
        tourStartDate: item.tourStartDate,
        bookings: {}
      };
    }
    if (!acc[item.tourId].bookings[item.bookingId]) {
      acc[item.tourId].bookings[item.bookingId] = {
        leadPassenger: item.leadPassenger,
        passengerCount: item.passengerCount,
        groupName: item.groupName,
        status: item.status,
        discrepancies: []
      };
    }
    acc[item.tourId].bookings[item.bookingId].discrepancies.push(item);
    return acc;
  }, {} as Record<string, { 
    tourName: string; 
    tourStartDate: string; 
    bookings: Record<string, {
      leadPassenger: string;
      passengerCount: number;
      groupName: string;
      status: string;
      discrepancies: DiscrepancyData[];
    }> 
  }>);

  const content = (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Grid3X3 className="h-6 w-6 text-brand-navy" />
        <h2 className="text-xl font-semibold">Activity Allocation Matrix - All Tours</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
        </div>
      ) : discrepancies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-green-600">All Clear! ✓</p>
          <p className="text-muted-foreground mt-2">
            No activity allocation discrepancies found across all active tours.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  {discrepancies.length} Discrepancies Found
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Activity allocations don't match booking passenger counts across {Object.keys(groupedByTourAndBooking).length} tour(s).
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-destructive"></div>
              <span>Missing Allocation (0 pax)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span>Mismatch (incorrect pax count)</span>
            </div>
          </div>

          {Object.entries(groupedByTourAndBooking).map(([tourId, tourData]) => {
            const totalBookings = Object.keys(tourData.bookings).length;
            const totalDiscrepancies = Object.values(tourData.bookings).reduce(
              (sum, booking) => sum + booking.discrepancies.length, 
              0
            );
            
            return (
              <div key={tourId} className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-4">
                  <h3 className="font-semibold text-lg">{tourData.tourName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDateToDDMMYYYY(tourData.tourStartDate)} • {totalBookings} booking{totalBookings !== 1 ? 's' : ''} with {totalDiscrepancies} discrepanc{totalDiscrepancies !== 1 ? 'ies' : 'y'}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Lead Passenger</TableHead>
                      <TableHead className="text-center">Booking Pax</TableHead>
                      <TableHead className="text-center">Issues</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(tourData.bookings).map(([bookingId, bookingData]) => {
                      const isExpanded = expandedBookings.has(bookingId);
                      const issueCount = bookingData.discrepancies.length;
                      
                      return (
                        <>
                          <TableRow key={bookingId} className="cursor-pointer hover:bg-muted/50">
                            <TableCell onClick={() => toggleBooking(bookingId)}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium" onClick={() => toggleBooking(bookingId)}>
                              {bookingData.leadPassenger}
                            </TableCell>
                            <TableCell className="text-center font-semibold" onClick={() => toggleBooking(bookingId)}>
                              {bookingData.passengerCount}
                            </TableCell>
                            <TableCell className="text-center" onClick={() => toggleBooking(bookingId)}>
                              <Badge variant="outline" className="bg-destructive/10 text-destructive">
                                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewBooking(tourId, bookingId)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && bookingData.discrepancies.map((disc, idx) => (
                            <TableRow key={`${bookingId}-${disc.activityId}-${idx}`} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="pl-8">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{disc.activityName}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {disc.activityDate ? formatDateToDDMMYYYY(disc.activityDate) : '-'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={getStatusColor(disc.discrepancyType)}>
                                  {disc.allocatedCount} allocated
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={getStatusColor(disc.discrepancyType)}>
                                  {disc.discrepancyType === 'missing' ? 'Missing' : 'Mismatch'}
                                </Badge>
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // If open/onOpenChange are provided, render as dialog
  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          {content}
          {!loading && discrepancies.length > 0 && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise render as page content
  return content;
};
