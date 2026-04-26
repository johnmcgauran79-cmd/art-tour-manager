
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "@/hooks/useActivities";
import { JourneysEditor, Journey } from "./JourneysEditor";
import { ActivityAttachmentsSection } from "./ActivityAttachmentsSection";
import {
  BOOKING_WORKFLOW_STATUS_OPTIONS,
  PAYMENT_WORKFLOW_STATUS_OPTIONS,
} from "@/lib/workflowStatuses";

interface EditActivityModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditActivityModal = ({ activity, open, onOpenChange }: EditActivityModalProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    activity_date: "",
    start_time: "",
    end_time: "",
    depart_for_activity: "",
    spots_booked: "",
    booking_status: "pending",
    payment_status: "unpaid",
    transport_status: "pending",
    transport_mode: "not_required",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    transport_company: "",
    transport_contact_name: "",
    transport_phone: "",
    transport_email: "",
    driver_name: "",
    driver_phone: "",
    dress_code: "not_required",
    hospitality_inclusions: "",
    notes: "",
    operations_notes: "",
    cancellation_terms: "",
    transport_notes: "",
    cancellation_details: "",
    cancellation_status: ""
  });
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [paxAttending, setPaxAttending] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (activity) {
      setFormData({
        name: activity.name || "",
        location: activity.location || "",
        activity_date: activity.activity_date || "",
        start_time: activity.start_time || "",
        end_time: activity.end_time || "",
        depart_for_activity: activity.depart_for_activity || "",
        spots_booked: activity.spots_available?.toString() || "",
        booking_status: activity.booking_status || "pending",
        payment_status: activity.payment_status || "unpaid",
        transport_status: activity.transport_status || "pending",
        transport_mode: activity.transport_mode || "not_required",
        contact_name: activity.contact_name || "",
        contact_phone: activity.contact_phone || "",
        contact_email: activity.contact_email || "",
        transport_company: activity.transport_company || "",
        transport_contact_name: activity.transport_contact_name || "",
        transport_phone: activity.transport_phone || "",
        transport_email: activity.transport_email || "",
        driver_name: activity.driver_name || "",
        driver_phone: activity.driver_phone || "",
        dress_code: activity.dress_code || "not_required",
        hospitality_inclusions: activity.hospitality_inclusions || "",
        notes: activity.notes || "",
        operations_notes: activity.operations_notes || "",
        cancellation_terms: (activity as any).cancellation_terms || "",
        transport_notes: activity.transport_notes || "",
        cancellation_details: (activity as any).cancellation_details || "",
        cancellation_status: (activity as any).cancellation_status || ""
      });

      // Load journeys from activity data
      const existingJourneys = (activity.activity_journeys || []).map(j => ({
        id: j.id,
        journey_number: j.journey_number,
        pickup_time: j.pickup_time || "",
        pickup_location: j.pickup_location || "",
        destination: j.destination || "",
      }));
      setJourneys(existingJourneys);

      fetchPaxAttending(activity.id);
    }
  }, [activity]);

  const fetchPaxAttending = async (activityId: string) => {
    const { data, error } = await supabase
      .from('activity_bookings')
      .select('passengers_attending, bookings!inner(status)')
      .eq('activity_id', activityId)
      .neq('bookings.status', 'cancelled');

    if (error) {
      setPaxAttending(0);
    } else {
      setPaxAttending(data.reduce((sum, b) => sum + (b.passengers_attending || 0), 0));
    }
  };

  const updateActivity = useMutation({
    mutationFn: async (activityData: any) => {
      const { data, error } = await supabase
        .from('activities')
        .update({
          name: activityData.name,
          location: activityData.location || null,
          activity_date: activityData.activity_date || null,
          start_time: activityData.start_time || null,
          end_time: activityData.end_time || null,
          depart_for_activity: activityData.depart_for_activity || null,
          spots_available: activityData.spots_available ? parseInt(activityData.spots_available) : 0,
          booking_status: activityData.booking_status,
          payment_status: activityData.payment_status,
          transport_status: activityData.transport_status,
          transport_mode: activityData.transport_mode || 'not_required',
          contact_name: activityData.contact_name || null,
          contact_phone: activityData.contact_phone || null,
          contact_email: activityData.contact_email || null,
          transport_company: activityData.transport_company || null,
          transport_contact_name: activityData.transport_contact_name || null,
          transport_phone: activityData.transport_phone || null,
          transport_email: activityData.transport_email || null,
          driver_name: activityData.driver_name || null,
          driver_phone: activityData.driver_phone || null,
          dress_code: activityData.dress_code || 'not_required',
          hospitality_inclusions: activityData.hospitality_inclusions || null,
          notes: activityData.notes || null,
          operations_notes: activityData.operations_notes || null,
          cancellation_terms: activityData.cancellation_terms || null,
          transport_notes: activityData.transport_notes || null,
          cancellation_details: activityData.cancellation_details || null,
          cancellation_status: activityData.cancellation_status || null,
        })
        .eq('id', activity?.id)
        .select()
        .single();

      if (error) throw error;

      // Update journeys: delete all, re-insert
      if (activity?.id) {
        await supabase.from('activity_journeys').delete().eq('activity_id', activity.id);
        if (journeys.length > 0) {
          const journeyRows = journeys.map((j, i) => ({
            activity_id: activity.id,
            journey_number: i + 1,
            pickup_time: j.pickup_time || null,
            pickup_location: j.pickup_location || null,
            destination: j.destination || null,
            sort_order: i,
          }));
          const { error: jErr } = await supabase.from('activity_journeys').insert(journeyRows);
          if (jErr) console.error('Error saving journeys:', jErr);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activity?.tour_id] });
      toast({ title: "Activity Updated", description: "Activity has been successfully updated." });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update activity.", variant: "destructive" });
      console.error('Error updating activity:', error);
    },
  });

  const deleteActivity = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('activities').delete().eq('id', activity?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activity?.tour_id] });
      toast({ title: "Activity Deleted", description: "Activity has been successfully deleted." });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete activity.", variant: "destructive" });
      console.error('Error deleting activity:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateActivity.mutate({ ...formData, spots_available: formData.spots_booked ? parseInt(formData.spots_booked) : 0 });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Activity Name & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Activity Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location} onChange={(e) => handleInputChange("location", e.target.value)} />
            </div>
          </div>

          {/* Row 2: Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity_date">Activity Date</Label>
              <Input id="activity_date" type="date" value={formData.activity_date} onChange={(e) => handleInputChange("activity_date", e.target.value)} />
            </div>
          </div>

          {/* Row 2b: Booking & Payment Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="booking_status">Booking Status</Label>
              <Select value={formData.booking_status} onValueChange={(value) => handleInputChange("booking_status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOKING_WORKFLOW_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_status">Payment Status</Label>
              <Select value={formData.payment_status} onValueChange={(value) => handleInputChange("payment_status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_WORKFLOW_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Spots & Pax */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spots_booked">Spots Booked</Label>
              <Input id="spots_booked" type="number" value={formData.spots_booked} onChange={(e) => handleInputChange("spots_booked", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pax_attending">Pax Attending (Read Only)</Label>
              <Input id="pax_attending" type="number" value={paxAttending} disabled className="bg-muted" />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Activity Start Time</Label>
              <Input id="start_time" type="time" value={formData.start_time} onChange={(e) => handleInputChange("start_time", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Activity End Time</Label>
              <Input id="end_time" type="time" value={formData.end_time} onChange={(e) => handleInputChange("end_time", e.target.value)} />
            </div>
          </div>

          {/* Depart & Transport Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depart_for_activity">Depart for Activity</Label>
              <Input id="depart_for_activity" type="time" value={formData.depart_for_activity} onChange={(e) => handleInputChange("depart_for_activity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport_mode">Transport Mode</Label>
              <Select value={formData.transport_mode} onValueChange={(value) => handleInputChange("transport_mode", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_required">Not Required</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="private_coach">Private Coach</SelectItem>
                  <SelectItem value="shuttle_bus">Shuttle Bus</SelectItem>
                  <SelectItem value="taxi">Taxi</SelectItem>
                  <SelectItem value="ferry">Ferry</SelectItem>
                  <SelectItem value="train">Public Transport</SelectItem>
                  <SelectItem value="air_flight">Air/Flight Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" value={formData.contact_name} onChange={(e) => handleInputChange("contact_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input id="contact_phone" value={formData.contact_phone} onChange={(e) => handleInputChange("contact_phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input id="contact_email" type="email" value={formData.contact_email} onChange={(e) => handleInputChange("contact_email", e.target.value)} />
            </div>
          </div>

          {/* Dress Code */}
          <div className="space-y-2">
            <Label htmlFor="dress_code">Dress Code</Label>
            <Select value={formData.dress_code} onValueChange={(value) => handleInputChange("dress_code", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select dress code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_required">Not Required</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="smart_casual">Smart Casual</SelectItem>
                <SelectItem value="casual_racewear">Casual Racewear (collared shirt, no jacket or tie required)</SelectItem>
                <SelectItem value="members_racewear">Members Racewear (Jacket & Tie)</SelectItem>
                <SelectItem value="black_tie">Black Tie</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hospitality */}
          <div className="space-y-2">
            <Label htmlFor="hospitality_inclusions">Hospitality Inclusions</Label>
            <Textarea id="hospitality_inclusions" value={formData.hospitality_inclusions} onChange={(e) => handleInputChange("hospitality_inclusions", e.target.value)} rows={3} />
          </div>

          {/* Transport Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Transport Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport_company">Transport Company</Label>
                <Input id="transport_company" value={formData.transport_company} onChange={(e) => handleInputChange("transport_company", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport_status">Transport Status</Label>
                <Select value={formData.transport_status} onValueChange={(value) => handleInputChange("transport_status", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_required">Not Required</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="paid_deposit">Paid Deposit</SelectItem>
                    <SelectItem value="fully_paid">Fully Paid</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport_contact_name">Transport Contact Name</Label>
                <Input id="transport_contact_name" value={formData.transport_contact_name} onChange={(e) => handleInputChange("transport_contact_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport_phone">Transport Phone</Label>
                <Input id="transport_phone" value={formData.transport_phone} onChange={(e) => handleInputChange("transport_phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport_email">Transport Email</Label>
                <Input id="transport_email" type="email" value={formData.transport_email} onChange={(e) => handleInputChange("transport_email", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driver_name">Driver Name</Label>
                <Input id="driver_name" value={formData.driver_name} onChange={(e) => handleInputChange("driver_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_phone">Driver Phone</Label>
                <Input id="driver_phone" value={formData.driver_phone} onChange={(e) => handleInputChange("driver_phone", e.target.value)} />
              </div>
            </div>

            {/* Journeys Section */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Journeys</h4>
              <JourneysEditor journeys={journeys} onChange={setJourneys} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport_notes">Transport Notes</Label>
              <Textarea id="transport_notes" value={formData.transport_notes} onChange={(e) => handleInputChange("transport_notes", e.target.value)} rows={3} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Activity Notes</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operations_notes">Operations Notes</Label>
            <Textarea id="operations_notes" value={formData.operations_notes} onChange={(e) => handleInputChange("operations_notes", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellation_terms">Cancellation / Terms</Label>
            <Textarea id="cancellation_terms" value={formData.cancellation_terms} onChange={(e) => handleInputChange("cancellation_terms", e.target.value)} rows={3} placeholder="Booking terms, cancellation fees, costs..." />
          </div>

          {/* Attachments */}
          {activity && (
            <div className="border-t pt-4">
              <ActivityAttachmentsSection activityId={activity.id} />
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={deleteActivity.isPending}>
              {deleteActivity.isPending ? "Deleting..." : "Delete Activity"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateActivity.isPending}>
                {updateActivity.isPending ? "Updating..." : "Update Activity"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{activity?.name}"? This will also remove all booking allocations for this activity. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteActivity.mutate(); setDeleteDialogOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Activity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
