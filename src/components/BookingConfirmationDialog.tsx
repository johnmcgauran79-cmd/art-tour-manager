import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface BookingConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isCreating: boolean;
  bookingData: {
    leadPassenger: {
      firstName: string;
      lastName: string;
      email: string;
    };
    otherPassengers: string[];
    tourName: string;
    passengerCount: number;
    checkInDate?: string;
    checkOutDate?: string;
    bedding?: string;
    hotels: Array<{
      name: string;
      checkIn: string;
      checkOut: string;
      bedding: string;
    }>;
    activities: Array<{
      name: string;
      paxCount: number;
    }>;
  };
}

export const BookingConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isCreating,
  bookingData,
}: BookingConfirmationDialogProps) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not set";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Booking Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Tour Information */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Tour</h3>
              <p className="text-muted-foreground">{bookingData.tourName}</p>
            </div>

            {/* Lead Passenger */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Lead Passenger</h3>
              <div className="space-y-1">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {bookingData.leadPassenger.firstName} {bookingData.leadPassenger.lastName}
                </p>
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {bookingData.leadPassenger.email}
                </p>
              </div>
            </div>

            {/* Other Passengers */}
            {bookingData.otherPassengers.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Other Passengers</h3>
                <ul className="list-disc list-inside space-y-1">
                  {bookingData.otherPassengers.map((passenger, index) => (
                    <li key={index} className="text-muted-foreground">
                      {passenger}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Total Passenger Count */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Total Passengers</h3>
              <p className="text-muted-foreground">{bookingData.passengerCount}</p>
            </div>

            {/* Hotels */}
            {bookingData.hotels.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Hotels</h3>
                <div className="space-y-3">
                  {bookingData.hotels.map((hotel, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-1">
                      <p className="font-medium">{hotel.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Check-in:</span> {formatDate(hotel.checkIn)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Check-out:</span> {formatDate(hotel.checkOut)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Bedding:</span> {hotel.bedding}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activities */}
            {bookingData.activities.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Activities</h3>
                <div className="space-y-2">
                  {bookingData.activities.map((activity, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2">
                      <p className="font-medium">{activity.name}</p>
                      <p className="text-muted-foreground">
                        {activity.paxCount} {activity.paxCount === 1 ? "passenger" : "passengers"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isCreating}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {isCreating ? "Creating Booking..." : "Confirm & Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
