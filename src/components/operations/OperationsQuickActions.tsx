import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Hotel, AlertCircle, Activity, Grid3X3 } from "lucide-react";
import { BookingValidationReport } from "@/components/BookingValidationReport";
import { ActivityCheckReport } from "@/components/ActivityCheckReport";
import { HotelAllocationCheckReport } from "@/components/HotelAllocationCheckReport";
import { AggregatedActivityMatrixReport } from "@/components/operations/AggregatedActivityMatrixReport";
import { useState } from "react";

export const OperationsQuickActions = () => {
  const [showValidationReport, setShowValidationReport] = useState(false);
  const [showActivityCheck, setShowActivityCheck] = useState(false);
  const [showHotelCheck, setShowHotelCheck] = useState(false);
  const [showActivityMatrix, setShowActivityMatrix] = useState(false);

  const checkActions = [
    {
      icon: AlertCircle,
      label: "Bedding Type Review",
      description: "Review pax/bedding mismatches",
      onClick: () => {
        setShowValidationReport(true);
      },
    },
    {
      icon: Grid3X3,
      label: "Non-standard Activity Bookings",
      description: "Review all activity allocations",
      onClick: () => {
        setShowActivityMatrix(true);
      },
    },
    {
      icon: Activity,
      label: "Activity Allocation Check",
      description: "Find missing activity allocations",
      onClick: () => {
        setShowActivityCheck(true);
      },
    },
    {
      icon: Hotel,
      label: "Hotel Allocation Check",
      description: "Find missing hotel allocations",
      onClick: () => {
        setShowHotelCheck(true);
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Reviews & Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {checkActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant="outline"
                  className="h-auto flex-col items-start p-4 hover:bg-brand-navy hover:text-brand-yellow transition-all"
                >
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </div>
                  <span className="text-xs text-left opacity-80">
                    {action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <BookingValidationReport 
        open={showValidationReport} 
        onOpenChange={setShowValidationReport} 
      />

      <ActivityCheckReport 
        open={showActivityCheck} 
        onOpenChange={setShowActivityCheck} 
      />
      
      <HotelAllocationCheckReport 
        open={showHotelCheck} 
        onOpenChange={setShowHotelCheck} 
      />

      <AggregatedActivityMatrixReport 
        open={showActivityMatrix} 
        onOpenChange={setShowActivityMatrix} 
      />
    </div>
  );
};
