
import { Card, CardContent } from "@/components/ui/card";
import { NotificationList } from "@/components/NotificationList";
import { NotificationHeader } from "@/components/NotificationHeader";
import { NotificationActions } from "@/components/NotificationActions";
import { NotificationEmptyState } from "@/components/NotificationEmptyState";
import { useNotifications } from "@/hooks/useNotifications";

interface MyNotificationsWidgetProps {
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
  showCard?: boolean;
}

export const MyNotificationsWidget = ({ 
  onNavigateToItem, 
  showCard = true 
}: MyNotificationsWidgetProps) => {
  // Use limit of 25 when showing in card format (all notifications view)
  // Use limit of 10 for dashboard preview
  const limit = showCard ? 25 : 10;
  
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
  } = useNotifications(limit);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all notifications
      const allIds = notifications.map(n => n.id);
      allIds.forEach(id => handleCheckboxChange(id, true));
    } else {
      // Deselect all notifications
      selectedNotifications.forEach(id => handleCheckboxChange(id, false));
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  const content = (
    <>
      {showCard && (
        <>
          <NotificationHeader 
            unreadCount={unreadCount}
            selectedCount={selectedNotifications.length}
            totalCount={notifications.length}
            showCard={showCard}
            onSelectAll={handleSelectAll}
          />
          
          {selectedNotifications.length > 0 && (
            <NotificationActions
              selectedCount={selectedNotifications.length}
              totalCount={notifications.length}
              onBulkDelete={handleBulkDelete}
              isDeleting={isDeleting}
              mode="delete"
            />
          )}
        </>
      )}

      {notifications.length === 0 ? (
        <NotificationEmptyState />
      ) : (
        <NotificationList
          notifications={notifications}
          selectedNotifications={selectedNotifications}
          onCheckboxChange={handleCheckboxChange}
          onNotificationClick={handleNotificationClick}
          onNavigateToItem={onNavigateToItem}
          onDelete={handleSingleDelete}
          maxHeight={showCard ? "500px" : "300px"}
        />
      )}
    </>
  );

  if (!showCard) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardContent className="p-6">
        {content}
      </CardContent>
    </Card>
  );
};
