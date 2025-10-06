import { 
  LayoutDashboard, 
  TrendingUp, 
  Plane, 
  Calendar, 
  Users, 
  Settings as SettingsIcon 
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdminOrManager: boolean;
}

export function AppSidebar({ activeTab, onTabChange, isAdminOrManager }: AppSidebarProps) {
  const { open } = useSidebar();

  const mainItems = [
    { title: "Dashboard", value: "dashboard", icon: LayoutDashboard },
    { title: "Operations", value: "operations", icon: TrendingUp },
    { title: "Tours", value: "tours", icon: Plane },
    { title: "Bookings", value: "bookings", icon: Calendar },
    { title: "Contacts", value: "contacts", icon: Users },
  ];

  const adminItems = isAdminOrManager ? [
    { title: "Settings", value: "settings", icon: SettingsIcon },
  ] : [];

  const allItems = [...mainItems, ...adminItems];

  return (
    <Sidebar 
      collapsible="offcanvas"
      className="border-r"
      style={{
        '--sidebar-width': '150px',
        '--sidebar-width-icon': '48px',
      } as React.CSSProperties}
    >
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
