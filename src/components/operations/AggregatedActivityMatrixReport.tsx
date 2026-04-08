import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { AlertTriangle, Grid3X3, Loader2, ChevronDown, ChevronRight, X, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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

interface Acknowledgment {
  booking_id: string;
  activity_id: string;
  tour_id: string;
  snapshot_passenger_count: number;
  snapshot_allocated_count: number;
  discrepancy_type: string;
}

export const AggregatedActivityMatrixReport = ({ 
  open = true, 
  onOpenChange 
}: AggregatedActivityMatrixReportProps = {}) => {
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyData[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open !== false) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [discResult, ackResult] = await Promise.all([
        supabase.rpc('get_activity_allocation_discrepancies'),
        supabase.from('activity_discrepancy_acknowledgments').select('booking_id, activity_id, tour_id, snapshot_passenger_count, snapshot_allocated_count, discrepancy_type')
      ]);

      if (discResult.error) throw discResult.error;

      const allDiscrepancies: DiscrepancyData[] = (discResult.data || []).map((row: any) => ({
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
      setAcknowledgments(ackResult.data || []);
    } catch (error) {
      console.error('Error fetching activity discrepancies:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a discrepancy is acknowledged AND hasn't changed since acknowledgment
  const isAcknowledged = (disc: DiscrepancyData): boolean => {
    const ack = acknowledgments.find(
      a => a.booking_id === disc.bookingId && a.activity_id === disc.activityId
    );
    if (!ack) return false;
    // If snapshot doesn't match current state, the acknowledgment is stale
    return ack.snapshot_passenger_count === disc.passengerCount && 
           ack.snapshot_allocated_count === disc.allocatedCount;
  };

  const isBookingFullyAcknowledged = (bookingDiscrepancies: DiscrepancyData[]): boolean => {
    return bookingDiscrepancies.every(isAcknowledged);
  };

  const isTourFullyAcknowledged = (bookings: Record<string, { discrepancies: DiscrepancyData[] }>): boolean => {
    return Object.values(bookings).every(b => isBookingFullyAcknowledged(b.discrepancies));
  };

  const acknowledgeDiscrepancy = async (disc: DiscrepancyData) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('activity_discrepancy_acknowledgments')
        .upsert({
          booking_id: disc.bookingId,
          activity_id: disc.activityId,
          tour_id: disc.tourId,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
          snapshot_passenger_count: disc.passengerCount,
          snapshot_allocated_count: disc.allocatedCount,
          discrepancy_type: disc.discrepancyType,
        }, { onConflict: 'booking_id,activity_id' });

      if (error) throw error;

      setAcknowledgments(prev => {
        const filtered = prev.filter(a => !(a.booking_id === disc.bookingId && a.activity_id === disc.activityId));
        return [...filtered, {
          booking_id: disc.bookingId,
          activity_id: disc.activityId,
          tour_id: disc.tourId,
          snapshot_passenger_count: disc.passengerCount,
          snapshot_allocated_count: disc.allocatedCount,
          discrepancy_type: disc.discrepancyType,
        }];
      });
      queryClient.invalidateQueries({ queryKey: ['activity-matrix-issues-count'] });
    } catch (error) {
      console.error('Error acknowledging discrepancy:', error);
      toast.error('Failed to acknowledge discrepancy');
    }
  };

  const acknowledgeBooking = async (bookingDiscrepancies: DiscrepancyData[]) => {
    if (!user) return;
    try {
      const upserts = bookingDiscrepancies.map(disc => ({
        booking_id: disc.bookingId,
        activity_id: disc.activityId,
        tour_id: disc.tourId,
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
        snapshot_passenger_count: disc.passengerCount,
        snapshot_allocated_count: disc.allocatedCount,
        discrepancy_type: disc.discrepancyType,
      }));

      const { error } = await supabase
        .from('activity_discrepancy_acknowledgments')
        .upsert(upserts, { onConflict: 'booking_id,activity_id' });

      if (error) throw error;

      setAcknowledgments(prev => {
        const bookingIds = new Set(bookingDiscrepancies.map(d => `${d.bookingId}-${d.activityId}`));
        const filtered = prev.filter(a => !bookingIds.has(`${a.booking_id}-${a.activity_id}`));
        return [...filtered, ...upserts.map(u => ({
          booking_id: u.booking_id,
          activity_id: u.activity_id,
          tour_id: u.tour_id,
          snapshot_passenger_count: u.snapshot_passenger_count,
          snapshot_allocated_count: u.snapshot_allocated_count,
          discrepancy_type: u.discrepancy_type,
        }))];
      });
      queryClient.invalidateQueries({ queryKey: ['activity-matrix-issues-count'] });
      toast.success('Booking acknowledged');
    } catch (error) {
      console.error('Error acknowledging booking:', error);
      toast.error('Failed to acknowledge booking');
    }
  };

  const acknowledgeTour = async (tourId: string, bookings: Record<string, { discrepancies: DiscrepancyData[] }>) => {
    if (!user) return;
    const allDiscs = Object.values(bookings).flatMap(b => b.discrepancies);
    try {
      const upserts = allDiscs.map(disc => ({
        booking_id: disc.bookingId,
        activity_id: disc.activityId,
        tour_id: disc.tourId,
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
        snapshot_passenger_count: disc.passengerCount,
        snapshot_allocated_count: disc.allocatedCount,
        discrepancy_type: disc.discrepancyType,
      }));

      const { error } = await supabase
        .from('activity_discrepancy_acknowledgments')
        .upsert(upserts, { onConflict: 'booking_id,activity_id' });

      if (error) throw error;

      setAcknowledgments(prev => {
        const keys = new Set(allDiscs.map(d => `${d.bookingId}-${d.activityId}`));
        const filtered = prev.filter(a => !keys.has(`${a.booking_id}-${a.activity_id}`));
        return [...filtered, ...upserts.map(u => ({
          booking_id: u.booking_id,
          activity_id: u.activity_id,
          tour_id: u.tour_id,
          snapshot_passenger_count: u.snapshot_passenger_count,
          snapshot_allocated_count: u.snapshot_allocated_count,
          discrepancy_type: u.discrepancy_type,
        }))];
      });
      queryClient.invalidateQueries({ queryKey: ['activity-matrix-issues-count'] });
      toast.success('Tour acknowledged');
    } catch (error) {
      console.error('Error acknowledging tour:', error);
      toast.error('Failed to acknowledge tour');
    }
  };

  const unacknowledgeBooking = async (bookingDiscrepancies: DiscrepancyData[]) => {
    try {
      for (const disc of bookingDiscrepancies) {
        await supabase
          .from('activity_discrepancy_acknowledgments')
          .delete()
          .eq('booking_id', disc.bookingId)
          .eq('activity_id', disc.activityId);
      }

      const keys = new Set(bookingDiscrepancies.map(d => `${d.bookingId}-${d.activityId}`));
      setAcknowledgments(prev => prev.filter(a => !keys.has(`${a.booking_id}-${a.activity_id}`)));
      toast.success('Acknowledgment removed');
    } catch (error) {
      console.error('Error removing acknowledgment:', error);
      toast.error('Failed to remove acknowledgment');
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

  // Filter based on acknowledged state
  const filteredGrouped = Object.entries(groupedByTourAndBooking).reduce((acc, [tourId, tourData]) => {
    const filteredBookings = Object.entries(tourData.bookings).reduce((bAcc, [bookingId, bookingData]) => {
      const bookingAcked = isBookingFullyAcknowledged(bookingData.discrepancies);
      if (!showAcknowledged && bookingAcked) return bAcc;
      if (showAcknowledged || !bookingAcked) {
        bAcc[bookingId] = bookingData;
      }
      return bAcc;
    }, {} as typeof tourData.bookings);

    if (Object.keys(filteredBookings).length > 0) {
      acc[tourId] = { ...tourData, bookings: filteredBookings };
    }
    return acc;
  }, {} as typeof groupedByTourAndBooking);

  const totalUnacknowledged = discrepancies.filter(d => !isAcknowledged(d)).length;
  const totalAcknowledged = discrepancies.filter(d => isAcknowledged(d)).length;
  const filteredDiscrepancyCount = Object.values(filteredGrouped).reduce(
    (sum, t) => sum + Object.values(t.bookings).reduce((s, b) => s + b.discrepancies.length, 0), 0
  );

  const content = (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-6 w-6 text-brand-navy" />
          <h2 className="text-xl font-semibold">Activity Allocation Matrix - All Tours</h2>
        </div>
        {discrepancies.length > 0 && (
          <div className="flex items-center gap-3">
            {totalAcknowledged > 0 && (
              <span className="text-sm text-muted-foreground">
                {totalAcknowledged} acknowledged
              </span>
            )}
            <div className="flex items-center gap-2">
              {showAcknowledged ? (
                <Eye className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={showAcknowledged}
                onCheckedChange={setShowAcknowledged}
              />
              <span className="text-sm text-muted-foreground">Show acknowledged</span>
            </div>
          </div>
        )}
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
      ) : totalUnacknowledged === 0 && !showAcknowledged ? (
        <div className="text-center py-12">
          <p className="text-lg font-semibold text-green-600">All Reviewed! ✓</p>
          <p className="text-muted-foreground mt-2">
            All {totalAcknowledged} discrepancies have been acknowledged. Toggle "Show acknowledged" to review them.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  {totalUnacknowledged} Unreviewed Discrepanc{totalUnacknowledged !== 1 ? 'ies' : 'y'}
                  {showAcknowledged && totalAcknowledged > 0 && (
                    <span className="font-normal text-amber-700"> (showing {filteredDiscrepancyCount} total including acknowledged)</span>
                  )}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Activity allocations don't match booking passenger counts across {Object.keys(filteredGrouped).length} tour(s).
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
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Acknowledged</span>
            </div>
          </div>

          {Object.entries(filteredGrouped).map(([tourId, tourData]) => {
            const totalBookings = Object.keys(tourData.bookings).length;
            const totalDiscrepancies = Object.values(tourData.bookings).reduce(
              (sum, booking) => sum + booking.discrepancies.length, 
              0
            );
            const tourFullyAcked = isTourFullyAcknowledged(tourData.bookings);
            
            return (
              <div key={tourId} className={`border rounded-lg overflow-hidden ${tourFullyAcked ? 'opacity-60' : ''}`}>
                <div className="bg-muted p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{tourData.tourName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDateToDDMMYYYY(tourData.tourStartDate)} • {totalBookings} booking{totalBookings !== 1 ? 's' : ''} with {totalDiscrepancies} discrepanc{totalDiscrepancies !== 1 ? 'ies' : 'y'}
                    </p>
                  </div>
                  {!tourFullyAcked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeTour(tourId, tourData.bookings)}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Acknowledge Tour
                    </Button>
                  )}
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
                      const bookingAcked = isBookingFullyAcknowledged(bookingData.discrepancies);
                      
                      return (
                        <>
                          <TableRow key={bookingId} className={`cursor-pointer hover:bg-muted/50 ${bookingAcked ? 'opacity-60' : ''}`}>
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
                              <div className="flex items-center gap-2">
                                {bookingData.leadPassenger}
                                {bookingAcked && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold" onClick={() => toggleBooking(bookingId)}>
                              {bookingData.passengerCount}
                            </TableCell>
                            <TableCell className="text-center" onClick={() => toggleBooking(bookingId)}>
                              <Badge variant="outline" className={bookingAcked ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'}>
                                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {!bookingAcked ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => acknowledgeBooking(bookingData.discrepancies)}
                                    title="Acknowledge booking"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => unacknowledgeBooking(bookingData.discrepancies)}
                                    title="Remove acknowledgment"
                                    className="text-muted-foreground"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewBooking(tourId, bookingId)}
                                >
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && bookingData.discrepancies.map((disc, idx) => {
                            const discAcked = isAcknowledged(disc);
                            return (
                              <TableRow key={`${bookingId}-${disc.activityId}-${idx}`} className={`bg-muted/30 ${discAcked ? 'opacity-60' : ''}`}>
                                <TableCell></TableCell>
                                <TableCell className="pl-8">
                                  <div className="flex items-center gap-2">
                                    {discAcked ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium">{disc.activityName}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {disc.activityDate ? formatDateToDDMMYYYY(disc.activityDate) : '-'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={discAcked ? 'bg-green-500/10 text-green-700' : getStatusColor(disc.discrepancyType)}>
                                    {disc.allocatedCount} allocated
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={discAcked ? 'bg-green-500/10 text-green-700' : getStatusColor(disc.discrepancyType)}>
                                    {discAcked ? 'Acknowledged' : disc.discrepancyType === 'missing' ? 'Missing' : 'Mismatch'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {!discAcked && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => acknowledgeDiscrepancy(disc)}
                                      title="Acknowledge this issue"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
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
