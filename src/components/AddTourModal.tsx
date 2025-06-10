
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddTourModal = ({ open, onOpenChange }: AddTourModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    duration: "",
    location: "",
    pickupPoint: "",
    status: "available",
    capacity: "",
    notes: "",
    inclusions: "",
    exclusions: "",
    singlePrice: "",
    doublePrice: "",
    deposit: "",
    finalPaymentDate: ""
  });

  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would typically save to a database
    console.log("Creating new tour:", formData);
    
    toast({
      title: "Tour Created",
      description: `${formData.name} has been successfully created.`,
    });

    // Reset form and close modal
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      duration: "",
      location: "",
      pickupPoint: "",
      status: "available",
      capacity: "",
      notes: "",
      inclusions: "",
      exclusions: "",
      singlePrice: "",
      doublePrice: "",
      deposit: "",
      finalPaymentDate: ""
    });
    onOpenChange(false);
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
              <Label htmlFor="name">Tour Name</Label>
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => handleInputChange("duration", e.target.value)}
                placeholder="e.g., 6 days, 5 nights"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Total Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => handleInputChange("capacity", e.target.value)}
                placeholder="e.g., 35"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupPoint">Pickup Point</Label>
              <Input
                id="pickupPoint"
                value={formData.pickupPoint}
                onChange={(e) => handleInputChange("pickupPoint", e.target.value)}
                placeholder="e.g., Sydney Airport"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sold-out">Sold Out</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="singlePrice">Single Price ($)</Label>
              <Input
                id="singlePrice"
                type="number"
                value={formData.singlePrice}
                onChange={(e) => handleInputChange("singlePrice", e.target.value)}
                placeholder="e.g., 2500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doublePrice">Double Price ($)</Label>
              <Input
                id="doublePrice"
                type="number"
                value={formData.doublePrice}
                onChange={(e) => handleInputChange("doublePrice", e.target.value)}
                placeholder="e.g., 2000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit">Deposit Required ($)</Label>
              <Input
                id="deposit"
                type="number"
                value={formData.deposit}
                onChange={(e) => handleInputChange("deposit", e.target.value)}
                placeholder="e.g., 500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finalPaymentDate">Final Payment Date</Label>
            <Input
              id="finalPaymentDate"
              type="date"
              value={formData.finalPaymentDate}
              onChange={(e) => handleInputChange("finalPaymentDate", e.target.value)}
            />
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
            <Button type="submit">Create Tour</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
