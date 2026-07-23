import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Map,
  BookOpen,
  Users,
  Settings as SettingsIcon,
  ListTodo,
  StickyNote,
  CalendarDays,
  Bot,
  Globe,
  Tag,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager, useUserRoles } from "@/hooks/useUserRoles";
import { usePersonalTodos } from "@/hooks/usePersonalTodos";
import { useMyTasks } from "@/hooks/useTaskQueries";
import { useBookings } from "@/hooks/useBookings";

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Query-param tab on the Index page, or a standalone route path. */
  tab?: string;
  path?: string;
  /** Optional count badge shown on the nav item. */
  badge?: number;
}

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const { data: roles = [] } = useUserRoles();
  const isAdmin = roles.includes("admin");
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const isAgent = userRole === "agent";
  const isHost = userRole === "host";

  // Counts for nav badges.
  const { data: todos = [] } = usePersonalTodos();
  const { data: myTasks = [] } = useMyTasks();
  const { data: allBookings = [] } = useBookings();
  const estimatedMonthlyRevenue = (() => {
    const now = new Date();
    return allBookings
      .filter((b: any) => {
        if (!b.created_at) return false;
        const d = new Date(b.created_at);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear() &&
          b.status !== 'cancelled'
        );
      })
      .reduce((sum: number, b: any) => sum + (b.revenue || 0), 0);
  })();
  const todoCount = todos.filter((t) => !t.completed).length;
  const overdueTaskCount = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return myTasks.filter((t) => {
      if (!t.due_date) return false;
      if (["completed", "cancelled", "archived", "not_required"].includes(t.status)) return false;
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
  })();

  const mainItems: NavItem[] = [];
  if (!isAgent && !isHost) mainItems.push({ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" });
  if (!isAgent) mainItems.push({ key: "art-ai", label: "ART AI", icon: Bot, path: "/art-ai" });
  if (!isAgent && !isHost) mainItems.push({ key: "operations", label: "Operations", icon: ClipboardList, tab: "operations" });
  if (isAdminOrManager) mainItems.push({ key: "tasks", label: "Tasks", icon: CheckSquare, tab: "tasks", badge: overdueTaskCount });
  mainItems.push({ key: "tours", label: "Tours", icon: Map, tab: "tours" });
  if (!isHost) mainItems.push({ key: "bookings", label: "Bookings", icon: BookOpen, tab: "bookings" });
  if (!isAgent && !isHost) mainItems.push({ key: "contacts", label: "Contacts", icon: Users, tab: "contacts" });
  if (isAdminOrManager) mainItems.push({ key: "settings", label: "Settings", icon: SettingsIcon, tab: "settings" });
  if (isAdminOrManager) mainItems.push({ key: "wordpress-content", label: "Website (WP)", icon: Globe, path: "/wordpress-content" });
  if (isAdmin) mainItems.push({ key: "audience-tagging", label: "Audience Tagging", icon: Tag, path: "/audience-tagging" });

  const workspaceItems: NavItem[] = [
    { key: "todos", label: "To-Do", icon: ListTodo, path: "/todos", badge: todoCount },
    { key: "notes", label: "Notes", icon: StickyNote, path: "/notes" },
    // Calendar is Admin/Manager only; hosts get To-Do + Notes for on-the-go use.
    ...(isAdminOrManager
      ? [{ key: "calendar", label: "Calendar", icon: CalendarDays, path: "/calendar" } as NavItem]
      : []),
  ];

  const showWorkspace = isAdminOrManager || isHost;

  const activeTab = (() => {
    if (location.pathname === "/") return searchParams.get("tab") || (isHost ? "tours" : "dashboard");
    return null;
  })();

  const handleNavigate = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.tab) {
      navigate(item.tab === "dashboard" ? "/" : `/?tab=${item.tab}`);
    }
    if (isMobile) setOpenMobile(false);
  };

  const isItemActive = (item: NavItem) => {
    if (item.path) return location.pathname === item.path;
    return location.pathname === "/" && activeTab === item.tab;
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const active = isItemActive(item);
    const showBadge = !!item.badge && item.badge > 0;
    const badgeEl = showBadge ? (
      <span
        className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1.5 text-[10px] font-semibold leading-none text-secondary-foreground"
      >
        {item.badge! > 99 ? "99+" : item.badge}
      </span>
    ) : null;
    const button = (
      <button
        type="button"
        onClick={() => handleNavigate(item)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md p-2 text-left text-sm outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          collapsed && !isMobile && "justify-center"
        )}
      >
        <span className="relative shrink-0">
          <item.icon className="h-4 w-4" />
          {showBadge && collapsed && !isMobile && (
            <span
              className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-secondary px-0.5 text-[8px] font-semibold leading-none text-secondary-foreground"
            >
              {item.badge! > 9 ? "9+" : item.badge}
            </span>
          )}
        </span>
        {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
        {(!collapsed || isMobile) && badgeEl}
      </button>
    );

    if (collapsed && !isMobile) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return button;
  };

  const NavContent = (
    <nav className="flex flex-col gap-4 px-4 pb-2 pt-6">
      <div className="flex flex-col gap-1">
        {mainItems.map((item) => (
          <NavButton key={item.key} item={item} />
        ))}
      </div>
      {showWorkspace && (
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
          {(!collapsed || isMobile) && (
            <span className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/70">
              My Workspace
            </span>
          )}
          {workspaceItems.map((item) => (
            <NavButton key={item.key} item={item} />
          ))}
          {isAdminOrManager && (!collapsed || isMobile) && (
            <div className="mt-3 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                Est. Monthly Revenue
              </div>
              <div className="mt-1 text-lg font-bold text-sidebar-foreground">
                ${estimatedMonthlyRevenue.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );

  // Mobile: off-canvas sheet driven by the header trigger.
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[16rem] bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="h-full overflow-auto pt-4">{NavContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: collapsible left column under the full-width header.
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "shrink-0 self-stretch overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
          collapsed ? "w-[3.5rem]" : "w-44"
        )}
      >
        {NavContent}
      </aside>
    </TooltipProvider>
  );
};