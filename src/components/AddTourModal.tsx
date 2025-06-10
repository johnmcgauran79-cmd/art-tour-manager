import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTour } from "@/hooks/useTours";

interface AddTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddTourModal = ({ open, onOpenChange }: AddTourModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    days: "",
    nights: "",
    location: "",
    pickup_point: "",
    status: "pending" as const,
    notes: "",
    inclusions: "",
    exclusions: "",
    price_single: "",
    price_double: "",
    price_twin: "",
    deposit_required: "",
    final_payment_date: ""
  });

  const createTour = useCreateTour();

  // Auto-calculate days and nights when start and end dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      
      if (endDate > startDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Include both start and end days
        const nightsDiff = daysDiff - 1;
        
        setFormData(prev => ({
          ...prev,
          days: daysDiff.toString(),
          nights: nightsDiff.toString()
        }));
      }
    }
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('Form data being submitted:', formData);
      
      // Validate required fields
      if (!formData.name || !formData.start_date || !formData.end_date || !formData.days || !formData.nights) {
        console.error('Missing required fields');
        return;
      }

      await createTour.mutateAsync({
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days: parseInt(formData.days),
        nights: parseInt(formData.nights),
        location: formData.location || null,
        pickup_point: formData.pickup_point || null,
        status: formData.status,
        notes: formData.notes || null,
        inclusions: formData.inclusions || null,
        exclusions: formData.exclusions || null,
        price_single: formData.price_single ? parseFloat(formData.price_single) : null,
        price_double: formData.price_double ? parseFloat(formData.price_double) : null,
        price_twin: formData.price_twin ? parseFloat(formData.price_twin) : null,
        deposit_required: formData.deposit_required ? parseFloat(formData.deposit_required) : null,
        instalment_details: null,
        final_payment_date: formData.final_payment_date || null,
      });

      // Reset form and close modal on success
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        days: "",
        nights: "",
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
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating tour:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tour</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tour Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Melbourne Cup Carnival 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="e.g., Melbourne, VIC"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange("start_date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange("end_date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Days (Auto-calculated)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                value={formData.days}
                onChange={(e) => handleInputChange("days", e.target.value)}
                placeholder="Auto-calculated from dates"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nights">Nights (Auto-calculated)</Label>
              <Input
                id="nights"
                type="number"
                min="0"
                value={formData.nights}
                onChange={(e) => handleInputChange("nights", e.target.value)}
                placeholder="Auto-calculated from dates"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_point">Pickup Point</Label>
              <Input
                id="pickup_point"
                value={formData.pickup_point}
                onChange={(e) => handleInputChange("pickup_point", e.target.value)}
                placeholder="e.g., Sydney Airport"
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
                min="0"
                value={formData.price_single}
                onChange={(e) => handleInputChange("price_single", e.target.value)}
                placeholder="e.g., 2500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_double">Double Price ($)</Label>
              <Input
                id="price_double"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_double}
                onChange={(e) => handleInputChange("price_double", e.target.value)}
                placeholder="e.g., 2000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_twin">Twin Price ($)</Label>
              <Input
                id="price_twin"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_twin}
                onChange={(e) => handleInputChange("price_twin", e.target.value)}
                placeholder="e.g., 2000"
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
                min="0"
                value={formData.deposit_required}
                onChange={(e) => handleInputChange("deposit_required", e.target.value)}
                placeholder="e.g., 500"
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
              placeholder="List what's included in the tour package..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exclusions">Exclusions</Label>
            <Textarea
              id="exclusions"
              value={formData.exclusions}
              onChange={(e) => handleInputChange("exclusions", e.target.value)}
              placeholder="List what's not included in the tour package..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional notes about the tour..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTour.isPending}>
              {createTour.isPending ? "Creating..." : "Create Tour"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
