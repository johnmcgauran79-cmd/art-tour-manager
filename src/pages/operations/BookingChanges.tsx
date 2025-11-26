import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WeeklyBookingChangesReport } from "@/components/reports/WeeklyBookingChangesReport";

export default function BookingChanges() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/?tab=operations")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Booking Changes Report</h1>
          <p className="text-muted-foreground">Review new bookings and changes over time</p>
        </div>
      </div>
      
      <WeeklyBookingChangesReport onClose={() => navigate("/?tab=operations")} />
    </div>
  );
}
