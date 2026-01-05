import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { PaymentAlertLevel } from "@/hooks/usePaymentAlerts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaymentStatusTrackerProps {
  activeLevel: PaymentAlertLevel | null;
  level1Count: number;
  level2Count: number;
  level3Count: number;
}

export const PaymentStatusTracker = ({
  activeLevel,
  level1Count,
  level2Count,
  level3Count,
}: PaymentStatusTrackerProps) => {
  if (!activeLevel) return null;

  // Determine color based on level and count
  const getColorClass = () => {
    if (activeLevel.count === 0) {
      return "text-green-600";
    }
    switch (activeLevel.level) {
      case 3:
        return "text-destructive";
      case 2:
        return "text-orange-500";
      case 1:
      default:
        return "text-blue-600";
    }
  };

  const getBadgeVariant = () => {
    if (activeLevel.count === 0) {
      return "secondary" as const;
    }
    switch (activeLevel.level) {
      case 3:
        return "destructive" as const;
      case 2:
        return "secondary" as const;
      case 1:
      default:
        return "secondary" as const;
    }
  };

  const getBadgeClassName = () => {
    if (activeLevel.count === 0) {
      return "bg-green-100 text-green-700";
    }
    switch (activeLevel.level) {
      case 3:
        return "";
      case 2:
        return "bg-orange-100 text-orange-700";
      case 1:
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative cursor-help">
            <DollarSign className={`h-5 w-5 ${getColorClass()}`} />
            <Badge
              variant={getBadgeVariant()}
              className={`absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs ${getBadgeClassName()}`}
            >
              {activeLevel.count}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{activeLevel.label}</p>
            <p className="text-sm text-muted-foreground">
              {activeLevel.description}
            </p>
            <div className="border-t pt-2 mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Deposits pending:</span>
                <span className="font-medium">{level1Count}</span>
              </div>
              <div className="flex justify-between">
                <span>Instalments pending:</span>
                <span className="font-medium">{level2Count}</span>
              </div>
              <div className="flex justify-between">
                <span>Not fully paid:</span>
                <span className="font-medium">{level3Count}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
