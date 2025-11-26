import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BookingValidationReport } from "@/components/BookingValidationReport";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

export default function BeddingReview() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <AppBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Operations", href: "/?tab=operations" },
          { label: "Bedding Type Review" }
        ]}
      />
      
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/?tab=operations")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bedding Type Review</h1>
          <p className="text-muted-foreground">Review passenger count and bedding type mismatches</p>
        </div>
      </div>
      
      <BookingValidationReport />
    </div>
  );
}
