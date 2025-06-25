
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

export const OperationsHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Operations Center
        </h2>
        <p className="text-muted-foreground mt-1">
          Your central hub for task management and operational oversight
        </p>
      </div>
      <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
        All Users Access
      </Badge>
    </div>
  );
};
