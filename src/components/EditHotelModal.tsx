
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Hotel } from "@/hooks/useHotels";
import { HotelAttachmentsSection } from "./HotelAttachmentsSection";
import { HotelDateCascadeModal } from "./HotelDateCascadeModal";

interface EditHotelModalProps {
  hotel: Hotel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditHotelModal = ({ hotel, open, onOpenChange }: EditHotelModalProps) => {
  const [formData, setFormData] = useState({
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
  });

  // Track cascade modal state
  const [cascadeModalOpen, setCascadeModalOpen] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState<{
    oldCheckIn: string;
    oldCheckOut: string;
    newCheckIn: string;
    newCheckOut: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (hotel) {
      setFormData({
        name: hotel.name || "",
        address: hotel.address || "",
        contact_name: hotel.contact_name || "",
        contact_phone: hotel.contact_phone || "",
        contact_email: hotel.contact_email || "",
        rooms_reserved: hotel.rooms_reserved?.toString() || "",
        booking_status: hotel.booking_status || "pending",
        default_room_type: hotel.default_room_type || "",
        default_check_in: hotel.default_check_in || "",
        default_check_out: hotel.default_check_out || "",
        extra_night_price: hotel.extra_night_price?.toString() || "",
        operations_notes: hotel.operations_notes || "",
        upgrade_options: hotel.upgrade_options || "",
        cancellation_policy: (hotel as any).cancellation_policy || "",
        initial_rooms_cutoff_date: (hotel as any).initial_rooms_cutoff_date || "",
        final_rooms_cutoff_date: (hotel as any).final_rooms_cutoff_date || ""
      });
    }
  }, [hotel]);

  const updateHotel = useMutation({
    mutationFn: async (hotelData: any) => {
      const { data, error } = await supabase
        .from('hotels')
        .update({
          name: hotelData.name,
          address: hotelData.address || null,
          contact_name: hotelData.contact_name || null,
          contact_phone: hotelData.contact_phone || null,
          contact_email: hotelData.contact_email || null,
          rooms_reserved: hotelData.rooms_reserved ? parseInt(hotelData.rooms_reserved) : null,
          booking_status: hotelData.booking_status,
          default_room_type: hotelData.default_room_type || null,
          default_check_in: hotelData.default_check_in,
          default_check_out: hotelData.default_check_out,
          extra_night_price: hotelData.extra_night_price ? parseFloat(hotelData.extra_night_price) : null,
          operations_notes: hotelData.operations_notes || null,
          upgrade_options: hotelData.upgrade_options || null,
          cancellation_policy: hotelData.cancellation_policy || null,
          initial_rooms_cutoff_date: hotelData.initial_rooms_cutoff_date || null,
          final_rooms_cutoff_date: hotelData.final_rooms_cutoff_date || null,
        })
        .eq('id', hotel?.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels', hotel?.tour_id] });
      toast({
        title: "Hotel Updated",
        description: "Hotel has been successfully updated.",
      });

      // Check if dates changed — if so, open cascade modal
      const oldCheckIn = hotel?.default_check_in || "";
      const oldCheckOut = hotel?.default_check_out || "";
      const datesChanged =
        formData.default_check_in !== oldCheckIn ||
        formData.default_check_out !== oldCheckOut;

      if (datesChanged && formData.default_check_in && formData.default_check_out && oldCheckIn && oldCheckOut) {
        setPendingDateChange({
          oldCheckIn,
          oldCheckOut,
          newCheckIn: formData.default_check_in,
          newCheckOut: formData.default_check_out,
        });
        setCascadeModalOpen(true);
      }

      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update hotel. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating hotel:', error);
    },
  });

  const deleteHotel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('hotels')
        .delete()
        .eq('id', hotel?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels', hotel?.tour_id] });
      toast({
        title: "Hotel Deleted",
        description: "Hotel has been successfully deleted.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete hotel. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting hotel:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateHotel.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this hotel?")) {
      deleteHotel.mutate();
    }
  };

  if (!hotel) return null;

  const mainDialog = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Hotel</DialogTitle>
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
                step="0.01"
                value={formData.extra_night_price}
                onChange={(e) => handleInputChange("extra_night_price", e.target.value)}
              />
            </div>

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

          <div className="space-y-2">
            <Label htmlFor="operations_notes">Operations Notes</Label>
            <Textarea
              id="operations_notes"
              value={formData.operations_notes}
              onChange={(e) => handleInputChange("operations_notes", e.target.value)}
              rows={3}
            />
          </div>

          <Separator />

          {hotel && (
            <HotelAttachmentsSection hotelId={hotel.id} />
          )}

          <Separator />

          <div className="flex justify-between">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteHotel.isPending}
            >
              {deleteHotel.isPending ? "Deleting..." : "Delete Hotel"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateHotel.isPending}>
                {updateHotel.isPending ? "Updating..." : "Update Hotel"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {mainDialog}
      {hotel && pendingDateChange && (
        <HotelDateCascadeModal
          open={cascadeModalOpen}
          onOpenChange={setCascadeModalOpen}
          hotelId={hotel.id}
          hotelName={hotel.name}
          oldCheckIn={pendingDateChange.oldCheckIn}
          oldCheckOut={pendingDateChange.oldCheckOut}
          newCheckIn={pendingDateChange.newCheckIn}
          newCheckOut={pendingDateChange.newCheckOut}
        />
      )}
    </>
  );
};
