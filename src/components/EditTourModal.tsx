
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useUpdateTour } from "@/hooks/useTours";

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
  instalmentAmount: number;
  instalmentDate: string;
  finalPaymentDate: string;
  totalCapacity: number;
  startDate: string;
  endDate: string;
  tourHost: string;
}

interface EditTourModalProps {
  tour: Tour | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourDeleted?: () => void;
}

export const EditTourModal = ({ tour, open, onOpenChange, onTourDeleted }: EditTourModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    tour_host: "",
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
    instalment_amount: "",
    instalment_date: "",
    final_payment_date: "",
    capacity: "",
    minimum_passengers_required: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateTourMutation = useUpdateTour();
  
  const updateTour = useMutation({
    mutationFn: async (tourData: any) => {
      console.log('EditTourModal: Updating tour with data:', tourData);
      
      // Calculate days and nights from start and end dates
      const startDate = new Date(tourData.start_date);
      const endDate = new Date(tourData.end_date);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      const days = daysDiff + 1; // Include both start and end days
      const nights = daysDiff;

      const updateData = {
        name: tourData.name,
        start_date: tourData.start_date,
        end_date: tourData.end_date,
        days: days,
        nights: nights,
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
        instalment_amount: tourData.instalment_amount ? parseFloat(tourData.instalment_amount) : null,
        instalment_date: tourData.instalment_date || null,
        final_payment_date: tourData.final_payment_date || null,
        capacity: tourData.capacity ? parseInt(tourData.capacity) : null,
        minimum_passengers_required: tourData.minimum_passengers_required ? parseInt(tourData.minimum_passengers_required) : null,
      };

      console.log('EditTourModal: Final update data:', updateData);

      // Use the useUpdateTour hook which includes notification logic
      return updateTourMutation.mutateAsync({
        tourId: tour?.id || '',
        updates: updateData
      });
    },
    onSuccess: () => {
      // Invalidate all tour-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      
      // Force refetch after a longer delay to ensure the trigger has processed
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['tours'] });
        queryClient.refetchQueries({ queryKey: ['tasks'] });
        queryClient.refetchQueries({ queryKey: ['my-tasks'] });
      }, 2000);
      
      toast({
        title: "Tour Updated",
        description: "Tour details have been successfully updated. Automated tasks will be regenerated to match the new dates.",
        duration: 6000,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('EditTourModal: Update error:', error);
      toast({
        title: "Error",
        description: `Failed to update tour: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const deleteTour = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tours')
        .delete()
        .eq('id', tour?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: "Tour Deleted",
        description: "Tour has been successfully deleted.",
      });
      onOpenChange(false);
      // Call the callback to close the parent modal
      if (onTourDeleted) {
        onTourDeleted();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete tour. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting tour:', error);
    },
  });

  useEffect(() => {
    if (tour && open) {
      console.log('Setting form data from tour:', tour);
      
      // Fetch the current tour data to get the minimum_passengers_required
      const fetchTourData = async () => {
        const { data, error } = await supabase
          .from('tours')
          .select('minimum_passengers_required')
          .eq('id', tour.id)
          .single();
        
        if (!error && data) {
          setFormData({
            name: tour.name,
            tour_host: tour.tourHost || "",
            start_date: tour.startDate ? formatDateForInput(tour.startDate) : "",
            end_date: tour.endDate ? formatDateForInput(tour.endDate) : "",
            days: "",
            nights: "",
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
            instalment_amount: tour.instalmentAmount?.toString() || "",
            instalment_date: tour.instalmentDate ? formatDateForInput(tour.instalmentDate) : "",
            final_payment_date: tour.finalPaymentDate ? formatDateForInput(tour.finalPaymentDate) : "",
            capacity: tour.totalCapacity?.toString() || "",
            minimum_passengers_required: data.minimum_passengers_required?.toString() || ""
          });
        }
      };
      
      fetchTourData();
    }
  }, [tour, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form with data:', formData);
    
    // Validate required fields
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Start Date, End Date).",
        variant: "destructive",
      });
      return;
    }
    
    // Validate date order
    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }
    
    updateTour.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    console.log(`Updating field ${field} with value:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDelete = () => {
    deleteTour.mutate();
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
              <Label htmlFor="name">Tour Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tour_host">Tour Host</Label>
              <Input
                id="tour_host"
                value={formData.tour_host || 'TBD'}
                readOnly
                className="bg-muted text-muted-foreground"
                placeholder="Automatically set from Host booking"
              />
              <p className="text-xs text-muted-foreground">
                Automatically populated from the lead passenger of the booking with "Host" status
              </p>
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
              <Label htmlFor="pickup_point">Start Location</Label>
              <Input
                id="pickup_point"
                value={formData.pickup_point}
                onChange={(e) => handleInputChange("pickup_point", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Max Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => handleInputChange("capacity", e.target.value)}
                placeholder="e.g., 50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_passengers_required">Minimum Passengers Required</Label>
              <Input
                id="minimum_passengers_required"
                type="number"
                value={formData.minimum_passengers_required}
                onChange={(e) => handleInputChange("minimum_passengers_required", e.target.value)}
                placeholder="e.g., 20"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
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
              <Label htmlFor="instalment_amount">Instalment Amount ($)</Label>
              <Input
                id="instalment_amount"
                type="number"
                step="0.01"
                value={formData.instalment_amount}
                onChange={(e) => handleInputChange("instalment_amount", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instalment_date">Instalment Due Date</Label>
              <Input
                id="instalment_date"
                type="date"
                value={formData.instalment_date}
                onChange={(e) => handleInputChange("instalment_date", e.target.value)}
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

          <div className="flex justify-between gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Tour
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete this tour?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the tour "{tour.name}" and all associated data including bookings, activities, and hotels.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Tour
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateTour.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {updateTour.isPending ? "Updating..." : "Update Tour"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
