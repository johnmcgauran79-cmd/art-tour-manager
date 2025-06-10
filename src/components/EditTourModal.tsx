
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

interface Tour {
  id: string;
  name: string;
  dates: string;
  duration: string;
  location: string;
  pickupPoint: string;
  status: string;
  notes: string;
  inclusions: string;
  exclusions: string;
  pricing: {
    single: number;
    double: number;
    twin: number;
  };
  deposit: number;
  finalPaymentDate: string;
}

interface EditTourModalProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditTourModal = ({ tour, open, onOpenChange }: EditTourModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    pickup_point: "",
    status: "pending",
    notes: "",
    inclusions: "",
    exclusions: "",
    price_single: "",
    price_double: "",
    price_twin: "",
    deposit_required: "",
    final_payment_date: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateTour = useMutation({
    mutationFn: async (tourData: any) => {
      const { data, error } = await supabase
        .from('tours')
        .update({
          name: tourData.name,
          location: tourData.location || null,
          pickup_point: tourData.pickup_point || null,
          status: tourData.status,
          notes: tourData.notes || null,
          inclusions: tourData.inclusions || null,
          exclusions: tourData.exclusions || null,
          price_single: tourData.price_single ? parseFloat(tourData.price_single) : null,
          price_double: tourData.price_double ? parseFloat(tourData.price_double) : null,
          price_twin: tourData.price_twin ? parseFloat(tourData.price_twin) : null,
          deposit_required: tourData.deposit_required ? parseFloat(tourData.deposit_required) : null,
          final_payment_date: tourData.final_payment_date || null,
        })
        .eq('id', tour?.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Updated",
        description: "Tour details have been successfully updated.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update tour. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating tour:', error);
    },
  });

  useEffect(() => {
    if (tour && open) {
      setFormData({
        name: tour.name,
        location: tour.location,
        pickup_point: tour.pickupPoint,
        status: tour.status,
        notes: tour.notes,
        inclusions: tour.inclusions,
        exclusions: tour.exclusions,
        price_single: tour.pricing.single?.toString() || "",
        price_double: tour.pricing.double?.toString() || "",
        price_twin: tour.pricing.twin?.toString() || "",
        deposit_required: tour.deposit?.toString() || "",
        final_payment_date: tour.finalPaymentDate
      });
    }
  }, [tour, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTour.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!tour) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tour: {tour.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tour Name</Label>
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
              <Label htmlFor="pickup_point">Pickup Point</Label>
              <Input
                id="pickup_point"
                value={formData.pickup_point}
                onChange={(e) => handleInputChange("pickup_point", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_single">Single Price ($)</Label>
              <Input
                id="price_single"
                type="number"
                step="0.01"
                value={formData.price_single}
                onChange={(e) => handleInputChange("price_single", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_double">Double Price ($)</Label>
              <Input
                id="price_double"
                type="number"
                step="0.01"
                value={formData.price_double}
                onChange={(e) => handleInputChange("price_double", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_twin">Twin Price ($)</Label>
              <Input
                id="price_twin"
                type="number"
                step="0.01"
                value={formData.price_twin}
                onChange={(e) => handleInputChange("price_twin", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit_required">Deposit Required ($)</Label>
              <Input
                id="deposit_required"
                type="number"
                step="0.01"
                value={formData.deposit_required}
                onChange={(e) => handleInputChange("deposit_required", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="final_payment_date">Final Payment Date</Label>
              <Input
                id="final_payment_date"
                type="date"
                value={formData.final_payment_date}
                onChange={(e) => handleInputChange("final_payment_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inclusions">Inclusions</Label>
            <Textarea
              id="inclusions"
              value={formData.inclusions}
              onChange={(e) => handleInputChange("inclusions", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exclusions">Exclusions</Label>
            <Textarea
              id="exclusions"
              value={formData.exclusions}
              onChange={(e) => handleInputChange("exclusions", e.target.value)}
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
            <Button type="submit" disabled={updateTour.isPending}>
              {updateTour.isPending ? "Updating..." : "Update Tour"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
