import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { useTourAlerts } from "@/hooks/useTourAlerts";

interface TourAlertButtonProps {
  tourId: string;
  onClick: (e: React.MouseEvent) => void;
}

export const TourAlertButton = ({ tourId, onClick }: TourAlertButtonProps) => {
  const { unacknowledgedCount } = useTourAlerts(tourId, false);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-7 gap-1.5 px-2"
    >
      <Bell className="h-4 w-4" />
      {unacknowledgedCount > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
          {unacknowledgedCount}
        </Badge>
      )}
    </Button>
  );
};
