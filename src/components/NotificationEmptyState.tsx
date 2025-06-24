
import { Bell } from "lucide-react";

export const NotificationEmptyState = () => {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p>No notifications yet</p>
    </div>
  );
};
