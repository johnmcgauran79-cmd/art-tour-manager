import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Printer, Mail, Bell, Check, RefreshCw, Paperclip } from "lucide-react";
import { useActivities, Activity } from "@/hooks/useActivities";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { ActivityPassengerListModal } from "./ActivityPassengerListModal";
import { EmailActivityPassengerListModal } from "./EmailActivityPassengerListModal";
import { ViewActivityModal } from "./ViewActivityModal";
import { useAuth } from "@/hooks/useAuth";
import { useTabAlerts } from "@/hooks/useTabAlerts";
import { TourAlert } from "@/hooks/useTourAlerts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TourActivitiesTabProps {
  tourId: string;
  alerts: TourAlert[];
  onAddActivity: () => void;
  onEditActivity: (activity: any) => void;
  onOpenAlerts?: () => void;
}

export const TourActivitiesTab = ({ tourId, alerts, onAddActivity, onEditActivity, onOpenAlerts }: TourActivitiesTabProps) => {
  console.log('TourActivitiesTab rendered with tourId:', tourId);
  
  const { data: activities, isLoading, error, refetch } = useActivities(tourId);
  const [paxAttendingData, setPaxAttendingData] = useState<Record<string, number>>({});
  const [selectedActivityForPrint, setSelectedActivityForPrint] = useState<any>(null);
  const [selectedActivityForEmail, setSelectedActivityForEmail] = useState<any>(null);
  const [selectedActivityForView, setSelectedActivityForView] = useState<Activity | null>(null);
  const { userRole } = useAuth();
  const { count: alertCount, criticalCount } = useTabAlerts(alerts, "activities");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch attachment counts for all activities in this tour
  const { data: attachmentCounts } = useQuery({
    queryKey: ['activity-attachment-counts', tourId],
    queryFn: async () => {
      const activityIds = activities?.map(a => a.id) || [];
      if (activityIds.length === 0) return {};
      const { data, error } = await supabase
        .from('activity_attachments')
        .select('activity_id')
        .in('activity_id', activityIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(row => {
        counts[row.activity_id] = (counts[row.activity_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!activities && activities.length > 0,
  });

  // Quick Update state
  const [quickUpdateMode, setQuickUpdateMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, { spots_available: number; activity_status: string }>>({});
  
  // Reset Activities state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
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

  const getActivityStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': 'bg-yellow-500 text-white hover:bg-yellow-500',
      'contacted_enquiry_sent': 'bg-yellow-500 text-white hover:bg-yellow-500',
      'on_hold': 'bg-orange-500 text-white hover:bg-orange-500',
      'booked': 'bg-blue-600 text-white hover:bg-blue-600',
      'tentative_booking': 'bg-blue-400 text-white hover:bg-blue-400',
      'paid_deposit': 'bg-green-400 text-white hover:bg-green-400',
      'fully_paid': 'bg-green-700 text-white hover:bg-green-700',
      'finalised': 'bg-gray-900 text-white hover:bg-gray-900',
      'confirmed': 'bg-gray-900 text-white hover:bg-gray-900',
      'cancelled': 'bg-red-600 text-white hover:bg-red-600',
    };
    return statusMap[status] || statusMap['pending'];
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    return `${hour12}:${minutes}${ampm}`;
  };

  const handleQuickUpdateToggle = () => {
    if (quickUpdateMode) {
      // Cancel mode - clear editing data
      setEditingData({});
    } else {
      // Enter mode - initialize editing data with current values
      const initialData: Record<string, { spots_available: number; activity_status: string }> = {};
      sortedActivities?.forEach(activity => {
        initialData[activity.id] = {
          spots_available: activity.spots_available || 0,
          activity_status: activity.activity_status || 'pending'
        };
      });
      setEditingData(initialData);
    }
    setQuickUpdateMode(!quickUpdateMode);
  };

  const handleUpdateActivity = async (activityId: string) => {
    const data = editingData[activityId];
    if (!data) return;

    const { error } = await supabase
      .from('activities')
      .update({
        spots_available: data.spots_available,
        activity_status: data.activity_status as any
      })
      .eq('id', activityId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update activity",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Activity updated successfully"
    });

    refetch();
  };

  const updateEditingData = (activityId: string, field: 'spots_available' | 'activity_status', value: number | string) => {
    setEditingData(prev => ({
      ...prev,
      [activityId]: {
        ...prev[activityId],
        [field]: value
      }
    }));
  };

  // Reset all activity allocations mutation
  const resetActivitiesMutation = useMutation({
    mutationFn: async () => {
      // Fetch all bookings for this tour (excluding cancelled)
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, passenger_count')
        .eq('tour_id', tourId)
        .neq('status', 'cancelled');

      if (bookingsError) throw bookingsError;
      if (!bookings || bookings.length === 0) {
        throw new Error('No bookings found for this tour');
      }

      // Fetch all activities for this tour
      const { data: tourActivities, error: activitiesError } = await supabase
        .from('activities')
        .select('id')
        .eq('tour_id', tourId);

      if (activitiesError) throw activitiesError;
      if (!tourActivities || tourActivities.length === 0) {
        throw new Error('No activities found for this tour');
      }

      // Delete all existing activity_bookings for this tour's activities
      const activityIds = tourActivities.map(a => a.id);
      const { error: deleteError } = await supabase
        .from('activity_bookings')
        .delete()
        .in('activity_id', activityIds);

      if (deleteError) throw deleteError;

      // Create new activity_bookings for all booking-activity combinations
      const activityBookings = [];
      for (const booking of bookings) {
        for (const activity of tourActivities) {
          activityBookings.push({
            booking_id: booking.id,
            activity_id: activity.id,
            passengers_attending: booking.passenger_count
          });
        }
      }

      const { error: insertError } = await supabase
        .from('activity_bookings')
        .insert(activityBookings);

      if (insertError) throw insertError;

      return { bookingsCount: bookings.length, activitiesCount: tourActivities.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-bookings'] });
      setResetDialogOpen(false);
      toast({
        title: "Activities Reset",
        description: `All ${data.bookingsCount} bookings have been allocated to all ${data.activitiesCount} activities with their passenger counts.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset activities",
        variant: "destructive",
      });
    },
  });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Activities</h3>
          {alertCount > 0 && (
            <button 
              onClick={onOpenAlerts}
              className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive' : 'text-yellow-600'}`} />
              <Badge 
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {alertCount}
              </Badge>
            </button>
          )}
        </div>
        {!isAgent && (
          <div className="flex flex-wrap gap-2">
            {userRole === 'admin' && (
              <Button 
                onClick={() => setResetDialogOpen(true)}
                variant="outline"
                size="sm"
                disabled={!activities || activities.length === 0}
              >
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            <Button
              onClick={handleQuickUpdateToggle}
              variant={quickUpdateMode ? "secondary" : "outline"}
              size="sm"
            >
              <span className="hidden sm:inline">{quickUpdateMode ? "Cancel Quick Update" : "Quick Update"}</span>
              <span className="sm:hidden">{quickUpdateMode ? "Cancel" : "Quick"}</span>
            </Button>
            <Button 
              onClick={onAddActivity}
              size="sm"
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              <span className="hidden sm:inline">Add Activity</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        )}
      </div>

      {sortedActivities && sortedActivities.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {sortedActivities.map((activity) => (
              <Card 
                key={activity.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedActivityForView(activity)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{activity.name}</p>
                      {activity.location && (
                        <p className="text-xs text-muted-foreground truncate">{activity.location}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(attachmentCounts?.[activity.id] || 0) > 0 && (
                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <Badge className={`text-xs ${getActivityStatusColor(activity.activity_status || 'pending')}`}>
                        {activity.activity_status?.replace(/_/g, ' ').toUpperCase() || 'PENDING'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {activity.activity_date ? formatDateToDDMMYYYY(activity.activity_date) : 'TBD'}
                    </span>
                    <span>{activity.start_time ? formatTime(activity.start_time) : '-'}</span>
                    <span>{paxAttendingData[activity.id] || 0} pax</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEditActivity(activity)} disabled={isAgent}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg">
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
                  <TableRow 
                    key={activity.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedActivityForView(activity)}
                  >
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {quickUpdateMode ? (
                        <Input
                          type="number"
                          value={editingData[activity.id]?.spots_available ?? activity.spots_available ?? 0}
                          onChange={(e) => updateEditingData(activity.id, 'spots_available', parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      ) : (
                        activity.spots_available || 0
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {paxAttendingData[activity.id] || 0}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {quickUpdateMode ? (
                        <Select
                          value={editingData[activity.id]?.activity_status ?? activity.activity_status ?? 'pending'}
                          onValueChange={(value) => updateEditingData(activity.id, 'activity_status', value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="booked">Booked</SelectItem>
                            <SelectItem value="paid_deposit">Paid Deposit</SelectItem>
                            <SelectItem value="fully_paid">Fully Paid</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="contacted_enquiry_sent">Contacted/Enquiry Sent</SelectItem>
                            <SelectItem value="tentative_booking">Tentative Booking</SelectItem>
                            <SelectItem value="finalised">Finalised</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getActivityStatusColor(activity.activity_status || 'pending')}>
                          {activity.activity_status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {quickUpdateMode ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateActivity(activity.id)}
                            title="Save Changes"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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
          defaultToEmail={selectedActivityForEmail.contact_email || ""}
        />
      )}

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Reset Activity Attendance</AlertDialogTitle>
            <AlertDialogDescription>
              This will refresh all bookings so they have all activities allocated to them, with the passenger count set as the amount attending each activity. 
              <br /><br />
              <strong>Warning:</strong> This will delete all existing activity allocations and recreate them based on current bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => resetActivitiesMutation.mutate()}
              disabled={resetActivitiesMutation.isPending}
            >
              {resetActivitiesMutation.isPending ? "Resetting..." : "Reset Activities"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ViewActivityModal
        activity={selectedActivityForView}
        open={!!selectedActivityForView}
        onOpenChange={(open) => !open && setSelectedActivityForView(null)}
        onEdit={onEditActivity}
      />
    </div>
  );
};
