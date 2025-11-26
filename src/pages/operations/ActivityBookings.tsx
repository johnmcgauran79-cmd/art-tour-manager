import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AggregatedActivityMatrixReport } from "@/components/operations/AggregatedActivityMatrixReport";

export default function ActivityBookings() {
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
          <h1 className="text-3xl font-bold tracking-tight">Non-standard Activity Bookings</h1>
          <p className="text-muted-foreground">Review activity allocation discrepancies across all tours</p>
        </div>
      </div>
      
      <AggregatedActivityMatrixReport open={true} onOpenChange={() => navigate("/?tab=operations")} />
    </div>
  );
}
