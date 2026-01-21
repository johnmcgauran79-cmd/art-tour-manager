import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddActivityModalProps {
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityCreated?: (activity: { id: string; name: string }) => void;
}

export const AddActivityModal = ({ tourId, open, onOpenChange, onActivityCreated }: AddActivityModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    activity_date: "",
    start_time: "",
    end_time: "",
    depart_for_activity: "",
    pickup_time: "",
    collection_time: "",
    pickup_location: "",
    collection_location: "",
    dropoff_location: "",
    spots_available: "",
    activity_status: "pending",
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
    hospitality_inclusions: "",
    notes: "",
    operations_notes: "",
    transport_notes: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createActivity = useMutation({
    mutationFn: async (activityData: any) => {
      console.log('Creating activity with data:', activityData);
      console.log('Tour ID:', tourId);
      
      if (!tourId) {
        throw new Error('Tour ID is required');
      }
      
      // Create the activity
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .insert([{
          tour_id: tourId,
          name: activityData.name,
          location: activityData.location || null,
          activity_date: activityData.activity_date || null,
          start_time: activityData.start_time || null,
          end_time: activityData.end_time || null,
          depart_for_activity: activityData.depart_for_activity || null,
          pickup_time: activityData.pickup_time || null,
          collection_time: activityData.collection_time || null,
          pickup_location: activityData.pickup_location || null,
          collection_location: activityData.collection_location || null,
          dropoff_location: activityData.dropoff_location || null,
          spots_available: activityData.spots_available ? parseInt(activityData.spots_available) : 0,
          spots_booked: 0,
          activity_status: activityData.activity_status,
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
          hospitality_inclusions: activityData.hospitality_inclusions || null,
          notes: activityData.notes || null,
          operations_notes: activityData.operations_notes || null,
          transport_notes: activityData.transport_notes || null,
        }])
        .select()
        .single();

      if (activityError) {
        console.error('Error creating activity:', activityError);
        throw activityError;
      }

      console.log('Activity created successfully:', activity);

      // Fetch all bookings for this tour (excluding cancelled)
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, passenger_count')
        .eq('tour_id', tourId)
        .neq('status', 'cancelled');

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        // Don't throw - activity was created successfully, just log the error
      }

      // Create activity_bookings for all existing bookings
      if (bookings && bookings.length > 0) {
        const activityBookings = bookings.map(booking => ({
          booking_id: booking.id,
          activity_id: activity.id,
          passengers_attending: booking.passenger_count
        }));

        const { error: allocError } = await supabase
          .from('activity_bookings')
          .insert(activityBookings);

        if (allocError) {
          console.error('Error creating activity allocations:', allocError);
          // Don't throw - activity was created successfully
        } else {
          console.log(`Created ${bookings.length} activity allocations`);
        }
      }

      return activity;
    },
    onSuccess: (data) => {
      console.log('Activity creation successful, invalidating queries...');
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', tourId] });
      
      toast({
        title: "Activity Added",
        description: "Activity has been successfully added to the tour.",
      });
      
      // Reset form
      setFormData({
        name: "",
        location: "",
        activity_date: "",
        start_time: "",
        end_time: "",
        depart_for_activity: "",
        pickup_time: "",
        collection_time: "",
        pickup_location: "",
        collection_location: "",
        dropoff_location: "",
        spots_available: "",
        activity_status: "pending",
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
        hospitality_inclusions: "",
        notes: "",
        operations_notes: "",
        transport_notes: ""
      });
      
      // Notify parent about the created activity for allocation
      if (onActivityCreated) {
        console.log('Calling onActivityCreated with activity:', { id: data.id, name: data.name });
        onActivityCreated({ id: data.id, name: data.name });
      } else {
        // Only close the modal if there's no callback (fallback for other uses)
        onOpenChange(false);
      }
    },
    onError: (error) => {
      console.error('Full error creating activity:', error);
      toast({
        title: "Error",
        description: `Failed to add activity: ${error.message}. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting activity form with data:', formData);
    console.log('Tour ID for submission:', tourId);
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Activity name is required.",
        variant: "destructive",
      });
      return;
    }
    
    createActivity.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Activity Name & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Activity Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Activity Date & Activity Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity_date">Activity Date</Label>
              <Input
                id="activity_date"
                type="date"
                value={formData.activity_date}
                onChange={(e) => handleInputChange("activity_date", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity_status">Activity Status</Label>
              <Select value={formData.activity_status} onValueChange={(value) => handleInputChange("activity_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="contacted_enquiry_sent">Contacted / Enquiry Sent</SelectItem>
                  <SelectItem value="tentative_booking">Tentative Booking</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="paid_deposit">Paid Deposit</SelectItem>
                  <SelectItem value="fully_paid">Fully Paid</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="finalised">Finalised</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Spots Available (Pax Attending is calculated/read-only in edit mode) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spots_available">Spots Available</Label>
              <Input
                id="spots_available"
                type="number"
                value={formData.spots_available}
                onChange={(e) => handleInputChange("spots_available", e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Activity Start Time & End Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Activity Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => handleInputChange("start_time", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Activity End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => handleInputChange("end_time", e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: Depart for Activity & Transport Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depart_for_activity">Depart for Activity</Label>
              <Input
                id="depart_for_activity"
                type="time"
                value={formData.depart_for_activity}
                onChange={(e) => handleInputChange("depart_for_activity", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport_mode">Transport Mode</Label>
              <Select value={formData.transport_mode} onValueChange={(value) => handleInputChange("transport_mode", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_required">Not Required</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="private_coach">Private Coach</SelectItem>
                  <SelectItem value="shuttle_bus">Shuttle Bus</SelectItem>
                  <SelectItem value="taxi">Taxi</SelectItem>
                  <SelectItem value="ferry">Ferry</SelectItem>
                  <SelectItem value="train">Train</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 6: Contact Name, Phone, Email */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleInputChange("contact_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => handleInputChange("contact_phone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleInputChange("contact_email", e.target.value)}
              />
            </div>
          </div>

          {/* Row 7: Hospitality Inclusions */}
          <div className="space-y-2">
            <Label htmlFor="hospitality_inclusions">Hospitality Inclusions</Label>
            <Textarea
              id="hospitality_inclusions"
              value={formData.hospitality_inclusions}
              onChange={(e) => handleInputChange("hospitality_inclusions", e.target.value)}
              rows={3}
            />
          </div>

          {/* Transport Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Transport Details</h3>
            
            {/* Transport Company & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport_company">Transport Company</Label>
                <Input
                  id="transport_company"
                  value={formData.transport_company}
                  onChange={(e) => handleInputChange("transport_company", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_status">Transport Status</Label>
                <Select value={formData.transport_status} onValueChange={(value) => handleInputChange("transport_status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

            {/* Transport Contact Name, Phone, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport_contact_name">Transport Contact Name</Label>
                <Input
                  id="transport_contact_name"
                  value={formData.transport_contact_name}
                  onChange={(e) => handleInputChange("transport_contact_name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_phone">Transport Phone</Label>
                <Input
                  id="transport_phone"
                  value={formData.transport_phone}
                  onChange={(e) => handleInputChange("transport_phone", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_email">Transport Email</Label>
                <Input
                  id="transport_email"
                  type="email"
                  value={formData.transport_email}
                  onChange={(e) => handleInputChange("transport_email", e.target.value)}
                />
              </div>
            </div>

            {/* Driver Name & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driver_name">Driver Name</Label>
                <Input
                  id="driver_name"
                  value={formData.driver_name}
                  onChange={(e) => handleInputChange("driver_name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_phone">Driver Phone</Label>
                <Input
                  id="driver_phone"
                  value={formData.driver_phone}
                  onChange={(e) => handleInputChange("driver_phone", e.target.value)}
                />
              </div>
            </div>

            {/* Pick Up Time & Collection Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickup_time">Pick Up Time</Label>
                <Input
                  id="pickup_time"
                  type="time"
                  value={formData.pickup_time}
                  onChange={(e) => handleInputChange("pickup_time", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection_time">Collection Time</Label>
                <Input
                  id="collection_time"
                  type="time"
                  value={formData.collection_time}
                  onChange={(e) => handleInputChange("collection_time", e.target.value)}
                />
              </div>
            </div>

            {/* Pickup Location & Collection Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickup_location">Pick Up Location</Label>
                <Input
                  id="pickup_location"
                  value={formData.pickup_location}
                  onChange={(e) => handleInputChange("pickup_location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection_location">Collection Location</Label>
                <Input
                  id="collection_location"
                  value={formData.collection_location}
                  onChange={(e) => handleInputChange("collection_location", e.target.value)}
                />
              </div>
            </div>

            {/* Drop Off Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dropoff_location">Drop Off Location</Label>
                <Input
                  id="dropoff_location"
                  value={formData.dropoff_location}
                  onChange={(e) => handleInputChange("dropoff_location", e.target.value)}
                />
              </div>
            </div>

            {/* Transport Notes */}
            <div className="space-y-2">
              <Label htmlFor="transport_notes">Transport Notes</Label>
              <Textarea
                id="transport_notes"
                value={formData.transport_notes}
                onChange={(e) => handleInputChange("transport_notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Activity Notes & Operations Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Activity Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operations_notes">Operations Notes</Label>
            <Textarea
              id="operations_notes"
              value={formData.operations_notes}
              onChange={(e) => handleInputChange("operations_notes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              disabled={createActivity.isPending}
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              {createActivity.isPending ? "Adding..." : "Add Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
