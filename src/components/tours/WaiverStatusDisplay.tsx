import { useWaiverStatus } from "@/hooks/useWaiverStatus";
import { CheckCircle, AlertCircle } from "lucide-react";
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

  if (!leadPassenger) {
    return <p className="text-sm text-muted-foreground">No passengers on this booking</p>;
  }

  // One waiver per booking: the lead booker signs on behalf of every passenger.
  const signed = waivers
    .filter((w) => w.signed_at)
    .sort((a, b) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime())[0];

  const covered = [
    `${leadPassenger.first_name} ${leadPassenger.last_name}`,
    ...(passengerCount >= 2 && passenger2 ? [`${passenger2.first_name} ${passenger2.last_name}`] : []),
    ...(passengerCount >= 3 && passenger3 ? [`${passenger3.first_name} ${passenger3.last_name}`] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {signed ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Signed
          </Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Signed
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-sm">
        {signed ? (
          <p className="text-green-700">
            Signed as "{signed.signed_name}"{" "}
            {formatDistanceToNow(new Date(signed.signed_at), { addSuffix: true })} by the lead booker.
          </p>
        ) : (
          <p className="text-yellow-700">No waiver signed for this booking yet.</p>
        )}
        <p className="text-muted-foreground text-xs">
          Covers {covered.length} passenger{covered.length !== 1 ? "s" : ""}: {covered.join(", ")}
        </p>
      </div>
    </div>
  );
};
