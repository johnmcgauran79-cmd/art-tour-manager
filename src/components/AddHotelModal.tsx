
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddHotelModalProps {
  tourId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    name: string;
    address: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    rooms_reserved: string;
    booking_status: string;
    default_room_type: string;
    default_check_in: string;
    default_check_out: string;
    extra_night_price: string;
    operations_notes: string;
    upgrade_options: string;
    cancellation_policy: string;
    initial_rooms_cutoff_date: string;
    final_rooms_cutoff_date: string;
  };
}

const emptyFormData = {
  name: "",
  address: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  rooms_reserved: "",
  booking_status: "pending",
  default_room_type: "",
  default_check_in: "",
  default_check_out: "",
  extra_night_price: "",
  operations_notes: "",
  upgrade_options: "",
  cancellation_policy: "",
  initial_rooms_cutoff_date: "",
  final_rooms_cutoff_date: ""
};

export const AddHotelModal = ({ tourId, open, onOpenChange, initialData }: AddHotelModalProps) => {
  const [formData, setFormData] = useState(initialData || emptyFormData);
  const [autoAllocate, setAutoAllocate] = useState(true);

  // Reset form when modal opens with new initialData
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setFormData(initialData);
      setAutoAllocate(false); // Default to no auto-allocate for duplicates
    } else if (!isOpen) {
      setFormData(emptyFormData);
      setAutoAllocate(true);
    }
    onOpenChange(isOpen);
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createHotel = useMutation({
    mutationFn: async (hotelData: any) => {
      console.log('Creating hotel with data:', hotelData);
      
      const { data, error } = await supabase
        .from('hotels')
        .insert([{
          tour_id: tourId,
          name: hotelData.name,
          address: hotelData.address || null,
          contact_name: hotelData.contact_name || null,
          contact_phone: hotelData.contact_phone || null,
          contact_email: hotelData.contact_email || null,
          rooms_reserved: hotelData.rooms_reserved ? parseInt(hotelData.rooms_reserved) : null,
          booking_status: hotelData.booking_status,
          default_room_type: hotelData.default_room_type || null,
          default_check_in: hotelData.default_check_in || null,
          default_check_out: hotelData.default_check_out || null,
          extra_night_price: hotelData.extra_night_price ? parseFloat(hotelData.extra_night_price) : null,
          operations_notes: hotelData.operations_notes || null,
          upgrade_options: hotelData.upgrade_options || null,
          cancellation_policy: hotelData.cancellation_policy || null,
          initial_rooms_cutoff_date: hotelData.initial_rooms_cutoff_date || null,
          final_rooms_cutoff_date: hotelData.final_rooms_cutoff_date || null,
          auto_allocate_on_create: autoAllocate,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating hotel:', error);
        throw error;
      }
      console.log('Hotel created successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels', tourId] });
      toast({
        title: "Hotel Added",
        description: "Hotel has been successfully added to the tour.",
      });
      handleOpenChange(false);
    },
    onError: (error) => {
      console.error('Hotel creation error:', error);
      toast({
        title: "Error",
        description: `Failed to add hotel: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting hotel form with data:', formData);
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Hotel name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.default_check_in || !formData.default_check_out) {
      toast({
        title: "Validation Error", 
        description: "Both check-in and check-out dates are required.",
        variant: "destructive",
      });
      return;
    }

    createHotel.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Hotel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Hotel Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="booking_status">Booking Status</Label>
              <Select value={formData.booking_status} onValueChange={(value) => handleInputChange("booking_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enquiry_sent">Enquiry Sent</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="contracted">Contracted</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="finalised">Finalised</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rooms_reserved">Rooms Reserved</Label>
              <Input
                id="rooms_reserved"
                type="number"
                min="0"
                value={formData.rooms_reserved}
                onChange={(e) => handleInputChange("rooms_reserved", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_room_type">Default Room Type</Label>
              <Input
                id="default_room_type"
                value={formData.default_room_type}
                onChange={(e) => handleInputChange("default_room_type", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_night_price">Extra Night Price ($)</Label>
              <Input
                id="extra_night_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.extra_night_price}
                onChange={(e) => handleInputChange("extra_night_price", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_check_in">Default Check-in Date *</Label>
              <Input
                id="default_check_in"
                type="date"
                value={formData.default_check_in}
                onChange={(e) => handleInputChange("default_check_in", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_check_out">Default Check-out Date *</Label>
              <Input
                id="default_check_out"
                type="date"
                value={formData.default_check_out}
                onChange={(e) => handleInputChange("default_check_out", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="upgrade_options">Upgrade Options</Label>
            <Textarea
              id="upgrade_options"
              value={formData.upgrade_options}
              onChange={(e) => handleInputChange("upgrade_options", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial_rooms_cutoff_date">Initial Rooms Cutoff Date</Label>
              <Input
                id="initial_rooms_cutoff_date"
                type="date"
                value={formData.initial_rooms_cutoff_date}
                onChange={(e) => handleInputChange("initial_rooms_cutoff_date", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="final_rooms_cutoff_date">Final Rooms Cutoff Date</Label>
              <Input
                id="final_rooms_cutoff_date"
                type="date"
                value={formData.final_rooms_cutoff_date}
                onChange={(e) => handleInputChange("final_rooms_cutoff_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
            <Textarea
              id="cancellation_policy"
              value={formData.cancellation_policy}
              onChange={(e) => handleInputChange("cancellation_policy", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto_allocate" className="text-sm font-medium">Auto-allocate to existing bookings</Label>
              <p className="text-sm text-muted-foreground">
                {autoAllocate 
                  ? "This hotel will be automatically allocated to all existing bookings requiring accommodation." 
                  : "Hotel will be added but not allocated to any bookings. You can manually allocate later."}
              </p>
            </div>
            <Switch
              id="auto_allocate"
              checked={autoAllocate}
              onCheckedChange={setAutoAllocate}
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
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
          <Button 
            type="submit" 
            disabled={createHotel.isPending}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            onClick={handleSubmit}
          >
            {createHotel.isPending ? "Adding..." : "Add Hotel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
