
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationHeader } from "@/components/NotificationHeader";
import { NotificationEmptyState } from "@/components/NotificationEmptyState";
import { NotificationList } from "@/components/NotificationList";

interface MyNotificationsWidgetProps {
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
  showCard?: boolean;
}

export const MyNotificationsWidget = ({ onNavigateToItem, showCard = true }: MyNotificationsWidgetProps) => {
  const {
    notifications,
    isLoading,
    selectedNotifications,
    unreadCount,
    handleNotificationClick,
    handleCheckboxChange,
    handleBulkDelete,
    handleSingleDelete,
    isDeleting,
  } = useNotifications();

  const content = (
    <>
      {showCard && (
        <CardHeader>
          <NotificationHeader
            unreadCount={unreadCount}
            selectedCount={selectedNotifications.length}
            totalCount={notifications.length}
            onBulkDelete={handleBulkDelete}
            isLoading={isDeleting}
          />
        </CardHeader>
      )}
      <CardContent className={showCard ? "" : "p-0"}>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <NotificationEmptyState />
        ) : (
          <NotificationList
            notifications={notifications}
            selectedNotifications={selectedNotifications}
            onCheckboxChange={handleCheckboxChange}
            onNotificationClick={handleNotificationClick}
            onNavigateToItem={onNavigateToItem}
            onDelete={handleSingleDelete}
          />
        )}
      </CardContent>
    </>
  );

  if (!showCard) {
    return <div>{content}</div>;
  }

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      {content}
    </Card>
  );
};
