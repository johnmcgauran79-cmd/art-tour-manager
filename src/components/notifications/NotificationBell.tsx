import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useUserNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  UserNotification,
} from "@/hooks/useUserNotifications";
import { cn } from "@/lib/utils";

const TASK_TYPES = new Set([
  "task_assignment",
  "subtask_assignment",
  "task_mention",
  "approval_request",
  "approval_decision",
]);

const priorityDot = (priority: string) => {
  switch (priority) {
    case "urgent":
    case "high":
      return "bg-destructive";
    case "medium":
      return "bg-brand-yellow";
    default:
      return "bg-muted-foreground";
  }
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading } = useUserNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleClick = (n: UserNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.related_id && TASK_TYPES.has(n.type)) {
      navigate(`/tasks/${n.related_id}`);
      setOpen(false);
    }
  };

  // Only show unread notifications — reading or marking all read removes them from the list
  const visibleNotifications = notifications.filter((n) => !n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/10 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[420px]">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {visibleNotifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !n.read && "bg-brand-yellow/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : priorityDot(n.priority)
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm leading-tight",
                          !n.read ? "font-semibold" : "font-medium text-foreground/90"
                        )}
                      >
                        {n.title}
                      </span>
                      {n.message && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
