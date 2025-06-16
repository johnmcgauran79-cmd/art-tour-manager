
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hotel } from "lucide-react";

interface HotelSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotels: Array<{
    id: string;
    name: string;
    address?: string;
  }>;
  tourName: string;
  onHotelSelect: (hotel: any) => void;
}

export const HotelSelectionDialog = ({
  open,
  onOpenChange,
  hotels,
  tourName,
  onHotelSelect
}: HotelSelectionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Select Hotel - {tourName}</DialogTitle>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-600">Select a hotel to view its rooming list:</p>
          <div className="grid gap-3">
            {hotels.map((hotel) => (
              <Card 
                key={hotel.id} 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onHotelSelect(hotel)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Hotel className="h-5 w-5 text-orange-600" />
                    <div>
                      <h3 className="font-medium">{hotel.name}</h3>
                      {hotel.address && (
                        <p className="text-sm text-gray-600">{hotel.address}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
