import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDateToAustralian } from "@/lib/utils";

interface ActivityCheckReportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ActivityCheckReport = ({ open, onOpenChange }: ActivityCheckReportProps = {}) => {
  const navigate = useNavigate();

  const { data: missingAllocations, isLoading } = useQuery({
    queryKey: ['activity-check-report'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_missing_activity_allocations');
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        bookingId: row.booking_id,
        tourId: row.tour_id,
        tourName: row.tour_name,
        tourDate: row.start_date,
        passengerName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        passengerCount: row.passenger_count,
        tourActivitiesCount: row.tour_activities,
        status: row.status
      }));
    },
    enabled: open !== false
  });

  const handleFixAllocations = async () => {
    if (!missingAllocations || missingAllocations.length === 0) return;

    try {
      // Get all activities for the affected tours
      const tourIds = [...new Set(missingAllocations.map(m => m.tourId))];
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('id, tour_id')
        .in('tour_id', tourIds);

      if (activitiesError) throw activitiesError;

      // Create activity bookings for each missing allocation
      const allocationsToCreate = [];
      for (const issue of missingAllocations) {
        const tourActivities = activities.filter(a => a.tour_id === issue.tourId);
        for (const activity of tourActivities) {
          allocationsToCreate.push({
            booking_id: issue.bookingId,
            activity_id: activity.id,
            passengers_attending: issue.passengerCount
          });
        }
      }

      if (allocationsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('activity_bookings')
          .insert(allocationsToCreate);

        if (insertError) throw insertError;

        toast.success(`Fixed ${missingAllocations.length} bookings with missing activity allocations`);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error fixing allocations:', error);
      toast.error('Failed to fix activity allocations');
    }
  };

  const handleViewBooking = (tourId: string, bookingId: string) => {
    navigate(`/tours/${tourId}?tab=bookings&bookingId=${bookingId}`);
    onOpenChange(false);
  };

  const content = (
    <>
      <div className="flex items-center gap-2 mb-6">
        <AlertCircle className="h-5 w-5 text-brand-navy" />
        <h2 className="text-xl font-semibold">Activity Allocation Check</h2>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading activity allocations...
        </div>
      ) : missingAllocations && missingAllocations.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              Found <strong>{missingAllocations.length}</strong> booking(s) with missing activity allocations
            </p>
          </div>

          <div className="space-y-3">
            {missingAllocations.map((issue) => (
              <Card key={issue.bookingId} className="p-4 border-amber-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold text-brand-navy">
                      {issue.tourName}
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Passenger:</span>
                        <span className="font-medium">{issue.passengerName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {issue.passengerCount} pax
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {issue.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Issue:</span>
                        <span className="text-amber-700">
                          Missing all {issue.tourActivitiesCount} activity allocations
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tour Date: {formatDateToAustralian(issue.tourDate)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewBooking(issue.tourId, issue.bookingId)}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={handleFixAllocations}
              className="flex-1"
            >
              Fix All Missing Allocations
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
          <div>
            <h3 className="font-semibold text-lg mb-2">All Clear!</h3>
            <p className="text-muted-foreground">
              No bookings found with missing activity allocations.
            </p>
          </div>
        </div>
      )}
    </>
  );

  // If open/onOpenChange are provided, render as dialog
  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise render as page content
  return content;
};
