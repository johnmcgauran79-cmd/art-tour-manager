
import { Bell } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NotificationHeaderProps {
  unreadCount: number;
  selectedCount: number;
  showCard?: boolean;
}

export const NotificationHeader = ({
  unreadCount,
  selectedCount,
  showCard = true
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
    </div>
  );
};
