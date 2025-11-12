import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardCheck, Users, Hotel, Calendar, TrendingUp, AlertCircle, FileSpreadsheet } from "lucide-react";
import { BookingValidationReport } from "@/components/BookingValidationReport";
import { useState } from "react";

export const OperationsQuickActions = () => {
  const [showValidationReport, setShowValidationReport] = useState(false);
  const reportActions = [
    {
      icon: FileText,
      label: "Passenger Reports",
      description: "Generate passenger lists and summaries",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Passenger Reports");
      },
    },
    {
      icon: Hotel,
      label: "Hotel Reports",
      description: "View rooming lists and allocations",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Hotel Reports");
      },
    },
    {
      icon: Calendar,
      label: "Activity Reports",
      description: "Activity allocation and attendance",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Activity Reports");
      },
    },
    {
      icon: Users,
      label: "Contact Reports",
      description: "Export and analyze contacts",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Contact Reports");
      },
    },
  ];

  const checkActions = [
    {
      icon: ClipboardCheck,
      label: "Pre-Tour Checklist",
      description: "Review all pre-tour requirements",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Pre-Tour Checklist");
      },
    },
    {
      icon: AlertCircle,
      label: "Booking Validation",
      description: "Review pax/bedding mismatches",
      active: true,
      onClick: () => {
        setShowValidationReport(true);
      },
    },
    {
      icon: TrendingUp,
      label: "Capacity Overview",
      description: "Review hotel and activity capacity",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Capacity Overview");
      },
    },
    {
      icon: FileSpreadsheet,
      label: "Custom Report",
      description: "Generate custom reports",
      active: false,
      onClick: () => {
        // To be implemented
        console.log("Custom Report");
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reports & Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  disabled={!action.active}
                  className={`h-auto flex flex-col items-start p-4 gap-2 transition-all ${
                    action.active 
                      ? 'hover:bg-brand-navy/5 hover:border-brand-navy/30 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={action.onClick}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`h-5 w-5 ${action.active ? 'text-brand-navy' : 'text-muted-foreground'}`} />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    {action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                  variant="outline"
                  disabled={!action.active}
                  className={`h-auto flex flex-col items-start p-4 gap-2 transition-all ${
                    action.active 
                      ? 'hover:bg-brand-navy/5 hover:border-brand-navy/30 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={action.onClick}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`h-5 w-5 ${action.active ? 'text-brand-navy' : 'text-muted-foreground'}`} />
                    <span className="font-semibold text-sm">{action.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
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
    </div>
  );
};
