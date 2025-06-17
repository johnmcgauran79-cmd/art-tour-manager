
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HotelAttachmentsSection } from "@/components/HotelAttachmentsSection";

interface HotelAttachmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  hotelName: string;
}

export const HotelAttachmentsModal = ({ 
  open, 
  onOpenChange, 
  hotelId, 
  hotelName 
}: HotelAttachmentsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attachments - {hotelName}</DialogTitle>
        </DialogHeader>
        <HotelAttachmentsSection hotelId={hotelId} />
      </DialogContent>
    </Dialog>
  );
};
