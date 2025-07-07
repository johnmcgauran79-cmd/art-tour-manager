
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useRef } from "react";

interface NotificationHeaderProps {
  unreadCount: number;
  selectedCount: number;
  totalCount?: number;
  showCard: boolean;
  onSelectAll?: (checked: boolean) => void;
}

export const NotificationHeader = ({ 
  unreadCount, 
  selectedCount, 
  totalCount = 0,
  showCard,
  onSelectAll 
}: NotificationHeaderProps) => {
  if (!showCard) return null;

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;
  const checkboxRef = useRef<HTMLButtonElement>(null);

  // Set indeterminate state using useEffect
  useEffect(() => {
    if (checkboxRef.current) {
      const checkbox = checkboxRef.current.querySelector('[role="checkbox"]') as HTMLElement;
      if (checkbox) {
        (checkbox as any).indeterminate = someSelected;
      }
    }
  }, [someSelected]);

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-brand-navy">My Notifications</h3>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {unreadCount} unread
          </span>
        )}
      </div>
      
      {totalCount > 0 && onSelectAll && (
        <div className="flex items-center gap-2">
          <Checkbox
            ref={checkboxRef}
            checked={allSelected}
            onCheckedChange={onSelectAll}
            className="h-4 w-4"
          />
          <span className="text-sm text-muted-foreground">
            Select all ({totalCount})
          </span>
        </div>
      )}
    </div>
  );
};
