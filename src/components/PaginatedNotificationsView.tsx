import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationHeader } from "@/components/NotificationHeader";
import { NotificationActions } from "@/components/NotificationActions";
import { NotificationList } from "@/components/NotificationList";
import { NotificationEmptyState } from "@/components/NotificationEmptyState";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useNotificationQuery } from "@/hooks/useNotificationQuery";
import { useNotificationMutations } from "@/hooks/useNotificationMutations";
import { Database } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

type Notification = Database['public']['Tables']['user_notifications']['Row'];

interface PaginatedNotificationsViewProps {
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
}

export const PaginatedNotificationsView = ({ onNavigateToItem }: PaginatedNotificationsViewProps) => {
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const notificationsPerPage = 25;
  
  // Calculate offset for pagination
  const offset = (currentPage - 1) * notificationsPerPage;
  
  const { data, isLoading, refetch } = useNotificationQuery(notificationsPerPage * currentPage);
  const notifications = data?.notifications || [];
  const totalUnreadCount = data?.totalUnreadCount || 0;
  
  const { markAsReadMutation, deleteNotificationMutation, bulkDeleteMutation } = useNotificationMutations();

  // Get current page notifications
  const currentPageNotifications = notifications.slice(offset, offset + notificationsPerPage);
  const totalPages = Math.ceil(notifications.length / notificationsPerPage);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleCheckboxChange = (notificationId: string, checked: boolean) => {
    setSelectedNotifications(prev => {
      return checked 
        ? [...prev, notificationId]
        : prev.filter(id => id !== notificationId);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(currentPageNotifications.map(n => n.id));
    } else {
      setSelectedNotifications([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length > 0) {
      try {
        await bulkDeleteMutation.mutateAsync(selectedNotifications);
        setSelectedNotifications([]);
        refetch();
      } catch (error) {
        console.error('Bulk delete failed:', error);
      }
    }
  };

  const handleSingleDelete = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId, {
      onSuccess: () => {
        setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
        refetch();
      }
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedNotifications([]);
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={currentPage === i}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            onClick={() => handlePageChange(1)}
            isActive={currentPage === 1}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => handlePageChange(i)}
              isActive={currentPage === i}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              onClick={() => handlePageChange(totalPages)}
              isActive={currentPage === totalPages}
              className="cursor-pointer"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <NotificationHeader 
        unreadCount={totalUnreadCount}
        selectedCount={selectedNotifications.length}
        totalCount={currentPageNotifications.length}
        showCard={true}
        onSelectAll={handleSelectAll}
      />
      
      <CardContent className="space-y-4">
        {notifications.length > 0 && (
          <NotificationActions
            selectedCount={selectedNotifications.length}
            totalCount={currentPageNotifications.length}
            onBulkDelete={handleBulkDelete}
            isDeleting={bulkDeleteMutation.isPending}
            mode="delete"
          />
        )}

        {notifications.length === 0 ? (
          <NotificationEmptyState />
        ) : (
          <>
            <NotificationList
              notifications={currentPageNotifications}
              selectedNotifications={selectedNotifications}
              onCheckboxChange={handleCheckboxChange}
              onNotificationClick={handleNotificationClick}
              onNavigateToItem={onNavigateToItem}
              onDelete={handleSingleDelete}
              maxHeight="600px"
            />

            {totalPages > 1 && (
              <div className="flex justify-center pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {renderPaginationItems()}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            <div className="text-sm text-muted-foreground text-center">
              Showing {offset + 1}-{Math.min(offset + notificationsPerPage, notifications.length)} of {notifications.length} notifications
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};