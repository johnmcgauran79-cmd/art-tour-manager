
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface NotificationActionsProps {
  selectedCount: number;
  totalCount: number;
  isLoading: boolean;
  onBulkAcknowledge: () => void;
  onAcknowledgeAll: () => void;
}

export const NotificationActions = ({
  selectedCount,
  totalCount,
  isLoading,
  onBulkAcknowledge,
  onAcknowledgeAll
}: NotificationActionsProps) => {
  if (totalCount === 0) return null;

  return (
    <div className="flex gap-2">
      {selectedCount > 0 && (
        <Button
          size="sm"
          onClick={onBulkAcknowledge}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Acknowledge ({selectedCount})
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onAcknowledgeAll}
        disabled={isLoading}
        className="h-7 text-xs"
      >
        Clear All
      </Button>
    </div>
  );
};
