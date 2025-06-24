
import { Bell } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationActions } from "@/components/NotificationActions";

interface NotificationHeaderProps {
  unreadCount: number;
  selectedCount: number;
  totalCount: number;
  onBulkDelete: () => void;
  isLoading: boolean;
}

export const NotificationHeader = ({
  unreadCount,
  selectedCount,
  totalCount,
  onBulkDelete,
  isLoading
}: NotificationHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-brand-navy" />
        <CardTitle className="text-brand-navy">Recent Notifications</CardTitle>
        {unreadCount > 0 && (
          <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
            {unreadCount} unread
          </Badge>
        )}
      </div>
      <NotificationActions 
        selectedCount={selectedCount}
        totalCount={totalCount}
        onBulkDelete={onBulkDelete}
        isLoading={isLoading}
        mode="delete"
      />
    </div>
  );
};
