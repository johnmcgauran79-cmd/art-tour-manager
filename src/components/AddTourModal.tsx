
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";

interface AddTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddTourModal = ({ open, onOpenChange }: AddTourModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    tour_host: "",
    location: "",
    pickup_point: "",
    start_date: "",
    end_date: "",
    notes: "",
    inclusions: "",
    exclusions: "",
    price_single: "",
    price_double: "",
    price_twin: "",
    deposit_required: "",
    instalment_amount: "",
    instalment_date: "",
    final_payment_date: "",
    capacity: "",
    minimum_passengers_required: "",
    tour_type: "domestic" as "domestic" | "international",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateDaysAndNights = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return { days: 1, nights: 0 };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      days: diffDays + 1, // Include both start and end days
      nights: diffDays
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { days, nights } = calculateDaysAndNights(formData.start_date, formData.end_date);

      const { error } = await supabase.from("tours").insert({
        name: formData.name,
        tour_host: "TBD",
        location: formData.location,
        pickup_point: formData.pickup_point,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days,
        nights,
        notes: formData.notes,
        inclusions: formData.inclusions,
        exclusions: formData.exclusions,
        price_single: formData.price_single ? parseFloat(formData.price_single) : null,
        price_double: formData.price_double ? parseFloat(formData.price_double) : null,
        price_twin: formData.price_twin ? parseFloat(formData.price_twin) : null,
        deposit_required: formData.deposit_required ? parseFloat(formData.deposit_required) : null,
        instalment_amount: formData.instalment_amount ? parseFloat(formData.instalment_amount) : null,
        instalment_date: formData.instalment_date || null,
        final_payment_date: formData.final_payment_date || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        minimum_passengers_required: formData.minimum_passengers_required ? parseInt(formData.minimum_passengers_required) : null,
        tour_type: formData.tour_type,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tour has been created successfully.",
      });

      // Reset form
      setFormData({
        name: "",
        tour_host: "",
        location: "",
        pickup_point: "",
        start_date: "",
        end_date: "",
        notes: "",
        inclusions: "",
        exclusions: "",
        price_single: "",
        price_double: "",
        price_twin: "",
        deposit_required: "",
        instalment_amount: "",
        instalment_date: "",
        final_payment_date: "",
        capacity: "",
        minimum_passengers_required: "",
        tour_type: "domestic",
      });

      queryClient.invalidateQueries({ queryKey: ["tours"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating tour:", error);
      toast({
        title: "Error",
        description: "Failed to create tour. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Add New Tour
          </DialogTitle>
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
              <Label htmlFor="tour_type">Tour Type *</Label>
              <Select 
                value={formData.tour_type} 
                onValueChange={(value: "domestic" | "international") => handleInputChange("tour_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tour type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestic">Domestic</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tour_host">Tour Host</Label>
              <Input
                id="tour_host"
                value="TBD"
                readOnly
                className="bg-muted text-muted-foreground"
                placeholder="Automatically set from Host booking"
              />
              <p className="text-xs text-muted-foreground">
                Will be automatically populated when a booking with "Host" status is created
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="Tour location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_point">Pickup Point</Label>
              <Input
                id="pickup_point"
                value={formData.pickup_point}
                onChange={(e) => handleInputChange("pickup_point", e.target.value)}
                placeholder="Pickup location"
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_single">Single Room Price</Label>
              <Input
                id="price_single"
                type="number"
                step="0.01"
                value={formData.price_single}
                onChange={(e) => handleInputChange("price_single", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_double">Double Room Price</Label>
              <Input
                id="price_double"
                type="number"
                step="0.01"
                value={formData.price_double}
                onChange={(e) => handleInputChange("price_double", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_twin">Twin Room Price</Label>
              <Input
                id="price_twin"
                type="number"
                step="0.01"
                value={formData.price_twin}
                onChange={(e) => handleInputChange("price_twin", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit_required">Deposit Required</Label>
              <Input
                id="deposit_required"
                type="number"
                step="0.01"
                value={formData.deposit_required}
                onChange={(e) => handleInputChange("deposit_required", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Maximum Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => handleInputChange("capacity", e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_passengers_required">Minimum Passengers Required</Label>
              <Input
                id="minimum_passengers_required"
                type="number"
                value={formData.minimum_passengers_required}
                onChange={(e) => handleInputChange("minimum_passengers_required", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inclusions">Inclusions</Label>
              <Textarea
                id="inclusions"
                value={formData.inclusions}
                onChange={(e) => handleInputChange("inclusions", e.target.value)}
                placeholder="What's included in the tour..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exclusions">Exclusions</Label>
              <Textarea
                id="exclusions"
                value={formData.exclusions}
                onChange={(e) => handleInputChange("exclusions", e.target.value)}
                placeholder="What's not included..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Additional notes..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
            >
              Close
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            onClick={handleSubmit}
          >
            {isLoading ? "Creating..." : "Create Tour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
