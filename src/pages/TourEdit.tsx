import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/utils";
import { useUpdateTour, useTours } from "@/hooks/useTours";
import { supabase } from "@/integrations/supabase/client";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

export default function TourEdit() {
  const { id } = useParams();
  const { isViewOnly } = usePermissions();
  const { goBack } = useNavigationContext();

  const { toast } = useToast();
  const { data: tours, isLoading } = useTours();
  const tour = tours?.find(t => t.id === id);
  
  const [formData, setFormData] = useState({
    name: "",
    tour_host: "",
    start_date: "",
    end_date: "",
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
    instalment_required: false,
    instalment_amount: "",
    instalment_date: "",
    final_payment_date: "",
    travel_documents_required: false,
    pickup_location_required: false,
    capacity: "",
    minimum_passengers_required: "",
    tour_type: "domestic" as "domestic" | "international"
  });

  const updateTourMutation = useUpdateTour();

  useEffect(() => {
    const fetchTourData = async () => {
      if (tour && id) {
        const { data, error } = await supabase
          .from('tours')
          .select('minimum_passengers_required, tour_type, instalment_required, travel_documents_required, pickup_location_required')
          .eq('id', id)
          .single();
        
        if (!error && data) {
          setFormData({
            name: tour.name,
            tour_host: tour.tour_host || "",
            start_date: tour.start_date ? formatDateForInput(tour.start_date) : "",
            end_date: tour.end_date ? formatDateForInput(tour.end_date) : "",
            location: tour.location,
            pickup_point: tour.pickup_point,
            status: tour.status,
            notes: tour.notes,
            inclusions: tour.inclusions,
            exclusions: tour.exclusions,
            price_single: tour.price_single?.toString() || "",
            price_double: tour.price_double?.toString() || "",
            price_twin: tour.price_twin?.toString() || "",
            deposit_required: tour.deposit_required?.toString() || "",
            instalment_required: data.instalment_required || false,
            instalment_amount: tour.instalment_amount?.toString() || "",
            instalment_date: tour.instalment_date ? formatDateForInput(tour.instalment_date) : "",
            final_payment_date: tour.final_payment_date ? formatDateForInput(tour.final_payment_date) : "",
            travel_documents_required: data.travel_documents_required || false,
            pickup_location_required: data.pickup_location_required || false,
            capacity: tour.capacity?.toString() || "",
            minimum_passengers_required: data.minimum_passengers_required?.toString() || "",
            tour_type: (data.tour_type as "domestic" | "international") || "domestic"
          });
        }
      }
    };
    
    fetchTourData();
  }, [tour, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Start Date, End Date).",
        variant: "destructive",
      });
      return;
    }
    
    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const days = daysDiff + 1;
    const nights = daysDiff;

    const updateData = {
      name: formData.name,
      start_date: formData.start_date,
      end_date: formData.end_date,
      days: days,
      nights: nights,
      location: formData.location || null,
      pickup_point: formData.pickup_point || null,
      status: formData.status as 'pending' | 'available' | 'sold_out' | 'closed' | 'past',
      notes: formData.notes || null,
      inclusions: formData.inclusions || null,
      exclusions: formData.exclusions || null,
      price_single: formData.price_single ? parseFloat(formData.price_single) : null,
      price_double: formData.price_double ? parseFloat(formData.price_double) : null,
      price_twin: formData.price_twin ? parseFloat(formData.price_twin) : null,
      deposit_required: formData.deposit_required ? parseFloat(formData.deposit_required) : null,
      instalment_required: formData.instalment_required,
      instalment_amount: formData.instalment_required && formData.instalment_amount ? parseFloat(formData.instalment_amount) : null,
      instalment_date: formData.instalment_required && formData.instalment_date ? formData.instalment_date : null,
      final_payment_date: formData.final_payment_date || null,
      travel_documents_required: formData.travel_documents_required,
      pickup_location_required: formData.pickup_location_required,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      minimum_passengers_required: formData.minimum_passengers_required ? parseInt(formData.minimum_passengers_required) : null,
      tour_type: formData.tour_type,
    };

    updateTourMutation.mutate({
      tourId: id!,
      updates: updateData
    }, {
      onSuccess: () => {
        toast({
          title: "Tour Updated",
          description: "Tour details have been successfully updated.",
          duration: 6000,
        });
        goBack(`/tours/${id}`);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: `Failed to update tour: ${error.message || 'Please try again.'}`,
          variant: "destructive",
        });
      },
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate final payment date (3 months before start) when start_date changes
      if (field === "start_date" && value && !prev.final_payment_date) {
        const startDate = new Date(value);
        startDate.setMonth(startDate.getMonth() - 3);
        updated.final_payment_date = startDate.toISOString().split('T')[0];
      }
      
      // Also update instalment date if instalment is required and date not set
      if (field === "start_date" && value && prev.instalment_required && !prev.instalment_date) {
        const startDate = new Date(value);
        startDate.setMonth(startDate.getMonth() - 6);
        updated.instalment_date = startDate.toISOString().split('T')[0];
      }
      
      return updated;
    });
  };

  if (isViewOnly) {
    return <Navigate to={`/tours/${id}`} replace />;
  }

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!tour) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Tour Not Found</h1>
        <Button onClick={() => goBack("/?tab=tours")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AppBreadcrumbs
        items={[
          { label: "Tours", href: "/?tab=tours" },
          { label: tour.name, href: `/tours/${tour.id}` },
          { label: "Edit" }
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Tour: {tour.name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goBack(`/tours/${id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tour
          </Button>
          <Button
            variant="default"
            size="sm"
            type="submit"
            onClick={handleSubmit}
            disabled={updateTourMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateTourMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card rounded-lg border p-6">
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
                <SelectItem value="limited_availability">Limited Availability</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="sold_out">Sold Out</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Label htmlFor="instalment_required">Instalment Required</Label>
            <Select 
              value={formData.instalment_required ? "yes" : "no"} 
              onValueChange={(value) => {
                const isRequired = value === "yes";
                setFormData(prev => {
                  // Auto-calculate instalment date as 6 months before tour start
                  let instalmentDate = prev.instalment_date;
                  if (isRequired && prev.start_date && !prev.instalment_date) {
                    const startDate = new Date(prev.start_date);
                    startDate.setMonth(startDate.getMonth() - 6);
                    instalmentDate = startDate.toISOString().split('T')[0];
                  }
                  return { 
                    ...prev, 
                    instalment_required: isRequired,
                    instalment_date: isRequired ? instalmentDate : ""
                  };
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.instalment_required && (
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
          )}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="travel_documents_required">Travel Documents Required</Label>
            <Select 
              value={formData.travel_documents_required ? "yes" : "no"} 
              onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  travel_documents_required: value === "yes"
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When enabled, bookings will show travel documents section (passport, ID, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_location_required">Pickup Location Required</Label>
            <Select 
              value={formData.pickup_location_required ? "yes" : "no"} 
              onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  pickup_location_required: value === "yes"
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When enabled, customers will be asked to select a pickup location.
            </p>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => goBack(`/tours/${id}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateTourMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateTourMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}