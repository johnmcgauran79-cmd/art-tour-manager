import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "@/hooks/useActivities";

interface EditActivityModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditActivityModal = ({ activity, open, onOpenChange }: EditActivityModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    activity_date: "",
    cutoff_date: "",
    start_time: "",
    end_time: "",
    pickup_time: "",
    collection_time: "",
    pickup_location: "",
    collection_location: "",
    dropoff_location: "",
    spots_booked: "",
    activity_status: "pending",
    transport_status: "pending",
    guide_name: "",
    guide_phone: "",
    guide_email: "",
    transport_company: "",
    transport_contact_name: "",
    transport_phone: "",
    transport_email: "",
    hospitality_inclusions: "",
    notes: "",
    operations_notes: "",
    transport_notes: ""
  });

  const [paxAttending, setPaxAttending] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (activity) {
      setFormData({
        name: activity.name || "",
        location: activity.location || "",
        activity_date: activity.activity_date || "",
        cutoff_date: activity.cutoff_date || "",
        start_time: activity.start_time || "",
        end_time: activity.end_time || "",
        pickup_time: activity.pickup_time || "",
        collection_time: activity.collection_time || "",
        pickup_location: activity.pickup_location || "",
        collection_location: activity.collection_location || "",
        dropoff_location: activity.dropoff_location || "",
        spots_booked: activity.spots_available?.toString() || "",
        activity_status: activity.activity_status || "pending",
        transport_status: activity.transport_status || "pending",
        guide_name: activity.guide_name || "",
        guide_phone: activity.guide_phone || "",
        guide_email: activity.guide_email || "",
        transport_company: activity.transport_company || "",
        transport_contact_name: activity.transport_contact_name || "",
        transport_phone: activity.transport_phone || "",
        transport_email: activity.transport_email || "",
        hospitality_inclusions: activity.hospitality_inclusions || "",
        notes: activity.notes || "",
        operations_notes: activity.operations_notes || "",
        transport_notes: activity.transport_notes || ""
      });

      // Fetch the actual pax attending from activity_bookings
      fetchPaxAttending(activity.id);
    }
  }, [activity]);

  const fetchPaxAttending = async (activityId: string) => {
    const { data, error } = await supabase
      .from('activity_bookings')
      .select(`
        passengers_attending,
        bookings!inner(status)
      `)
      .eq('activity_id', activityId)
      .neq('bookings.status', 'cancelled');

    if (error) {
      console.error('Error fetching pax attending:', error);
      setPaxAttending(0);
    } else {
      const total = data.reduce((sum, booking) => sum + (booking.passengers_attending || 0), 0);
      setPaxAttending(total);
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
          cutoff_date: activityData.cutoff_date || null,
          start_time: activityData.start_time || null,
          end_time: activityData.end_time || null,
          pickup_time: activityData.pickup_time || null,
          collection_time: activityData.collection_time || null,
          pickup_location: activityData.pickup_location || null,
          collection_location: activityData.collection_location || null,
          dropoff_location: activityData.dropoff_location || null,
          spots_available: activityData.spots_available ? parseInt(activityData.spots_available) : 0,
          activity_status: activityData.activity_status,
          transport_status: activityData.transport_status,
          guide_name: activityData.guide_name || null,
          guide_phone: activityData.guide_phone || null,
          guide_email: activityData.guide_email || null,
          transport_company: activityData.transport_company || null,
          transport_contact_name: activityData.transport_contact_name || null,
          transport_phone: activityData.transport_phone || null,
          transport_email: activityData.transport_email || null,
          hospitality_inclusions: activityData.hospitality_inclusions || null,
          notes: activityData.notes || null,
          operations_notes: activityData.operations_notes || null,
          transport_notes: activityData.transport_notes || null,
        })
        .eq('id', activity?.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activity?.tour_id] });
      toast({
        title: "Activity Updated",
        description: "Activity has been successfully updated.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update activity. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating activity:', error);
    },
  });

  const deleteActivity = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activity?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activity?.tour_id] });
      toast({
        title: "Activity Deleted",
        description: "Activity has been successfully deleted.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete activity. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting activity:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateActivity.mutate({
      ...formData,
      spots_available: formData.spots_booked ? parseInt(formData.spots_booked) : 0
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this activity?")) {
      deleteActivity.mutate();
    }
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="cutoff_date">Cutoff Date</Label>
              <Input
                id="cutoff_date"
                type="date"
                value={formData.cutoff_date}
                onChange={(e) => handleInputChange("cutoff_date", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spots_booked">Spots Booked</Label>
              <Input
                id="spots_booked"
                type="number"
                value={formData.spots_booked}
                onChange={(e) => handleInputChange("spots_booked", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pax_attending">Pax Attending (Read Only)</Label>
              <Input
                id="pax_attending"
                type="number"
                value={paxAttending}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => handleInputChange("start_time", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => handleInputChange("end_time", e.target.value)}
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
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="finalised">Finalised</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport_status">Transport Status</Label>
              <Select value={formData.transport_status} onValueChange={(value) => handleInputChange("transport_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_required">Not Required</SelectItem>
                  <SelectItem value="enquiry_sent">Enquiry Sent</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked">Checked</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guide_name">Guide Name</Label>
              <Input
                id="guide_name"
                value={formData.guide_name}
                onChange={(e) => handleInputChange("guide_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guide_phone">Guide Phone</Label>
              <Input
                id="guide_phone"
                value={formData.guide_phone}
                onChange={(e) => handleInputChange("guide_phone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guide_email">Guide Email</Label>
              <Input
                id="guide_email"
                type="email"
                value={formData.guide_email}
                onChange={(e) => handleInputChange("guide_email", e.target.value)}
              />
            </div>
          </div>

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
              <Label htmlFor="transport_contact_name">Transport Contact</Label>
              <Input
                id="transport_contact_name"
                value={formData.transport_contact_name}
                onChange={(e) => handleInputChange("transport_contact_name", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Transport Details</h3>
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

              <div className="space-y-2">
                <Label htmlFor="dropoff_location">Drop Off Location</Label>
                <Input
                  id="dropoff_location"
                  value={formData.dropoff_location}
                  onChange={(e) => handleInputChange("dropoff_location", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hospitality_inclusions">Hospitality Inclusions</Label>
            <Textarea
              id="hospitality_inclusions"
              value={formData.hospitality_inclusions}
              onChange={(e) => handleInputChange("hospitality_inclusions", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteActivity.isPending}
            >
              {deleteActivity.isPending ? "Deleting..." : "Delete Activity"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateActivity.isPending}>
                {updateActivity.isPending ? "Updating..." : "Update Activity"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
