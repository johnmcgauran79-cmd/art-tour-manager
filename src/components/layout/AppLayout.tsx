import { ReactNode } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const isAdmin = userRole === 'admin';
  const isMobile = useIsMobile();
  
  // Agent users can only see bookings tab
  const isAgent = userRole === 'agent';

  // Determine active tab from current route and query params
  const getActiveTab = () => {
    const path = location.pathname;
    const tabParam = searchParams.get('tab');
    
    // If we have a tab query param on the index page, use that
    if (path === '/' && tabParam) {
      return tabParam;
    }
    
    // Otherwise determine from the route
    if (path === '/') return 'dashboard';
    if (path.startsWith('/tours')) return 'tours';
    if (path.startsWith('/bookings')) return 'bookings';
    if (path.startsWith('/tasks')) return 'operations';
    if (path.startsWith('/contacts')) return 'contacts';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const handleTabChange = (value: string) => {
    switch (value) {
      case 'dashboard':
        navigate('/');
        break;
      case 'operations':
        navigate('/?tab=operations');
        break;
      case 'tours':
        navigate('/?tab=tours');
        break;
      case 'bookings':
        navigate('/?tab=bookings');
        break;
      case 'contacts':
        navigate('/?tab=contacts');
        break;
      case 'settings':
        navigate('/?tab=settings');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader isAdmin={isAdmin} />

      <div className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs value={getActiveTab()} onValueChange={handleTabChange} className="w-full">
            <TabsList className={`w-full ${isMobile ? 'h-auto grid grid-cols-3 gap-1' : isAgent ? 'flex' : `grid ${isAdminOrManager ? 'grid-cols-6' : 'grid-cols-5'}`}`}>
              {!isAgent && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
              {!isAgent && <TabsTrigger value="operations">Operations</TabsTrigger>}
              {!isAgent && <TabsTrigger value="tours">Tours</TabsTrigger>}
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              {!isAgent && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
              {isAdminOrManager && (
                <TabsTrigger value="settings">Settings</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
