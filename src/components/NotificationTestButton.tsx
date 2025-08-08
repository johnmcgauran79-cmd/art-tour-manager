import { Button } from "@/components/ui/button";
import { useSimpleNotifications } from "@/hooks/useSimpleNotifications";
import { useToast } from "@/hooks/use-toast";

export const NotificationTestButton = () => {
  const { sendNotificationToDepartments } = useSimpleNotifications();
  const { toast } = useToast();

  const testNotification = async () => {
    const success = await sendNotificationToDepartments(['operations', 'booking'], {
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working correctly.',
      type: 'system',
      priority: 'low',
      related_id: 'test-' + Date.now()
    });

    if (success) {
      toast({
        title: "Success",
        description: "Test notification sent successfully!",
      });
    }
  };

  return (
    <Button onClick={testNotification} variant="outline" size="sm">
      Test Notifications
    </Button>
  );
};