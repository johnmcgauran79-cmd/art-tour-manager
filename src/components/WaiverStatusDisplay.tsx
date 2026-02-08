import { useWaiverStatus } from "@/hooks/useWaiverStatus";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface WaiverStatusDisplayProps {
  bookingId: string;
  passengerCount: number;
  leadPassenger?: { id: string; first_name: string; last_name: string } | null;
  passenger2?: { id: string; first_name: string; last_name: string } | null;
  passenger3?: { id: string; first_name: string; last_name: string } | null;
}

export const WaiverStatusDisplay = ({
  bookingId,
  passengerCount,
  leadPassenger,
  passenger2,
  passenger3,
}: WaiverStatusDisplayProps) => {
  const { data: waivers = [], isLoading } = useWaiverStatus(bookingId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading waiver status...</p>;
  }

  const getPassengerName = (slot: number) => {
    if (slot === 1 && leadPassenger) return `${leadPassenger.first_name} ${leadPassenger.last_name}`;
    if (slot === 2 && passenger2) return `${passenger2.first_name} ${passenger2.last_name}`;
    if (slot === 3 && passenger3) return `${passenger3.first_name} ${passenger3.last_name}`;
    return `Passenger ${slot}`;
  };

  const getPassengerLabel = (slot: number) => {
    return slot === 1 ? "Lead Passenger" : `Passenger ${slot}`;
  };

  // Build passenger slots to display
  const slots: number[] = [];
  if (leadPassenger) slots.push(1);
  if (passengerCount >= 2 && passenger2) slots.push(2);
  if (passengerCount >= 3 && passenger3) slots.push(3);

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">No passengers on this booking</p>;
  }

  const allSigned = slots.every(slot => waivers.some(w => w.passenger_slot === slot));
  const noneSigned = waivers.length === 0;

  return (
    <div className="space-y-3">
      {/* Overall status */}
      <div className="flex items-center gap-2">
        {allSigned ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            All Signed
          </Badge>
        ) : noneSigned ? (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Signed
          </Badge>
        ) : (
          <Badge className="bg-orange-100 text-orange-800">
            <Clock className="h-3 w-3 mr-1" />
            Partially Signed
          </Badge>
        )}
      </div>

      {/* Per-passenger status */}
      <div className="space-y-2">
        {slots.map(slot => {
          const waiver = waivers.find(w => w.passenger_slot === slot);
          return (
            <div key={slot} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
              <div>
                <span className="font-medium">{getPassengerLabel(slot)}</span>
                <span className="text-muted-foreground ml-1">({getPassengerName(slot)})</span>
              </div>
              <div className="flex items-center gap-2">
                {waiver ? (
                  <div className="flex items-center gap-1 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">
                      Signed as "{waiver.signed_name}"{" "}
                      {formatDistanceToNow(new Date(waiver.signed_at), { addSuffix: true })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">Not signed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
