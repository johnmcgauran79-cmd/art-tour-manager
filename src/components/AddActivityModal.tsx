
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
}

export const AddActivityModal = ({ tourId, open, onOpenChange }: AddActivityModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    activity_date: "",
    start_time: "",
    end_time: "",
    pickup_time: "",
    collection_time: "",
    pickup_location: "",
    collection_location: "",
    dropoff_location: "",
    spots_available: "",
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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createActivity = useMutation({
    mutationFn: async (activityData: any) => {
      const { data, error } = await supabase
        .from('activities')
        .insert([{
          tour_id: tourId,
          name: activityData.name,
          location: activityData.location || null,
          activity_date: activityData.activity_date || null,
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
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({
        title: "Activity Added",
        description: "Activity has been successfully added to the tour.",
      });
      onOpenChange(false);
      setFormData({
        name: "",
        location: "",
        activity_date: "",
        start_time: "",
        end_time: "",
        pickup_time: "",
        collection_time: "",
        pickup_location: "",
        collection_location: "",
        dropoff_location: "",
        spots_available: "",
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
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add activity. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating activity:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
              <Label htmlFor="spots_available">Spots Available</Label>
              <Input
                id="spots_available"
                type="number"
                value={formData.spots_available}
                onChange={(e) => handleInputChange("spots_available", e.target.value)}
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
                  <SelectItem value="confirmed">Confirmed</SelectItem>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? "Adding..." : "Add Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
