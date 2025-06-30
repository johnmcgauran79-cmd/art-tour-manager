
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, List } from "lucide-react";
import { MyNotificationsWidget } from "@/components/MyNotificationsWidget";

interface OperationsNotificationsCardProps {
  onViewAllNotifications: () => void;
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
}

export const OperationsNotificationsCard = ({ 
  onViewAllNotifications, 
  onNavigateToItem 
}: OperationsNotificationsCardProps) => {
  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">Recent Notifications</CardTitle>
            <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
              Latest Updates
            </Badge>
          </div>
          <Button
            onClick={onViewAllNotifications}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            View All Notifications
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <MyNotificationsWidget showCard={false} onNavigateToItem={onNavigateToItem} />
      </CardContent>
    </Card>
  );
};
