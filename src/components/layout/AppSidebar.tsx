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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Query-param tab on the Index page, or a standalone route path. */
  tab?: string;
  path?: string;
}

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const { setOpenMobile, isMobile } = useSidebar();

  const isAgent = userRole === "agent";
  const isHost = userRole === "host";

  const mainItems: NavItem[] = [];
  if (!isAgent && !isHost) mainItems.push({ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" });
  if (!isAgent && !isHost) mainItems.push({ key: "operations", label: "Operations", icon: ClipboardList, tab: "operations" });
  if (isAdminOrManager) mainItems.push({ key: "tasks", label: "Tasks", icon: CheckSquare, tab: "tasks" });
  mainItems.push({ key: "tours", label: "Tours", icon: Map, tab: "tours" });
  if (!isHost) mainItems.push({ key: "bookings", label: "Bookings", icon: BookOpen, tab: "bookings" });
  if (!isAgent && !isHost) mainItems.push({ key: "contacts", label: "Contacts", icon: Users, tab: "contacts" });
  if (isAdminOrManager) mainItems.push({ key: "settings", label: "Settings", icon: SettingsIcon, tab: "settings" });

  const workspaceItems: NavItem[] = [
    { key: "todos", label: "To-Do", icon: ListTodo, path: "/todos" },
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-2">
          <img
            src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
            alt="Australian Racing Tours"
            className="h-8 w-auto shrink-0"
          />
          <span className="font-display text-sm font-semibold leading-tight group-data-[collapsible=icon]:hidden">
            Australian Racing Tours
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={isItemActive(item)}
                    onClick={() => handleNavigate(item)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showWorkspace && (
          <SidebarGroup>
            <SidebarGroupLabel>My Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceItems.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isItemActive(item)}
                      onClick={() => handleNavigate(item)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
};