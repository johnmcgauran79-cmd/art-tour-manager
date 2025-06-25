
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";

interface NotificationActionsProps {
  selectedCount: number;
  totalCount?: number;
  isLoading?: boolean;
  isDeleting?: boolean;
  onBulkAcknowledge?: () => void;
  onAcknowledgeAll?: () => void;
  onBulkDelete?: () => void;
  mode?: 'acknowledge' | 'delete';
}

export const NotificationActions = ({
  selectedCount,
  totalCount = 0,
  isLoading = false,
  isDeleting = false,
  onBulkAcknowledge,
  onAcknowledgeAll,
  onBulkDelete,
  mode = 'acknowledge'
}: NotificationActionsProps) => {
  if (totalCount === 0) return null;

  const isActionLoading = isLoading || isDeleting;

  if (mode === 'delete') {
    return (
      <div className="flex gap-2">
        {selectedCount > 0 && onBulkDelete && (
          <Button
            size="sm"
            onClick={onBulkDelete}
            disabled={isActionLoading}
            className="h-7 text-xs"
            variant="destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete ({selectedCount})
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {selectedCount > 0 && onBulkAcknowledge && (
        <Button
          size="sm"
          onClick={onBulkAcknowledge}
          disabled={isActionLoading}
          className="h-7 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Acknowledge ({selectedCount})
        </Button>
      )}
      {onAcknowledgeAll && (
        <Button
          size="sm"
          variant="outline"
          onClick={onAcknowledgeAll}
          disabled={isActionLoading}
          className="h-7 text-xs"
        >
          Clear All
        </Button>
      )}
    </div>
  );
};
