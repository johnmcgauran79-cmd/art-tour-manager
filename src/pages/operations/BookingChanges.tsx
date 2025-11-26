import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WeeklyBookingChangesReport } from "@/components/reports/WeeklyBookingChangesReport";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { BookingChangesReportPDF } from "@/components/reports/BookingChangesReportPDF";
import { useState } from "react";

interface WeeklyChange {
  id: string;
  timestamp: string;
  operation_type: string;
  booking_id: string;
  customer_name: string;
  tour_name: string;
  user_name: string;
  details?: any;
}

export default function BookingChanges() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<{ changes: WeeklyChange[], period: string } | null>(null);

  return (
    <div className="space-y-6">
      <AppBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Operations", href: "/?tab=operations" },
          { label: "Booking Changes Report" }
        ]}
      />
      
      <div className="flex items-center justify-between gap-4">
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
        {reportData && reportData.changes.length > 0 && (
          <BookingChangesReportPDF changes={reportData.changes} period={reportData.period} />
        )}
      </div>
      
      <WeeklyBookingChangesReport 
        onDataChange={(changes, period) => setReportData({ changes, period })} 
      />
    </div>
  );
}
