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
  
  // Agent users can only see bookings and tours tabs
  const isAgent = userRole === 'agent';
  
  // Host users can only see tours tab
  const isHost = userRole === 'host';

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
    if (path.startsWith('/tasks')) return 'tasks';
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
      case 'tasks':
        navigate('/?tab=tasks');
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <Tabs value={getActiveTab()} className="w-full">
            <TabsList className={`w-full h-auto p-1 ${
              isMobile 
                ? `grid ${isHost ? 'grid-cols-1' : isAgent ? 'grid-cols-2' : isAdminOrManager ? 'grid-cols-4' : 'grid-cols-3'} gap-1` 
                : isHost
                  ? 'grid grid-cols-1 max-w-[120px]'
                  : isAgent 
                    ? 'grid grid-cols-2' 
                    : `grid ${isAdminOrManager ? 'grid-cols-7' : 'grid-cols-6'}`
            }`}>
              {!isAgent && !isHost && (
                <TabsTrigger value="dashboard" onClick={() => handleTabChange('dashboard')} className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Home</span>
                </TabsTrigger>
              )}
              {!isAgent && !isHost && (
                <TabsTrigger value="operations" onClick={() => handleTabChange('operations')} className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Operations</span>
                  <span className="sm:hidden">Ops</span>
                </TabsTrigger>
              )}
              {!isAgent && !isHost && (
                <TabsTrigger value="tasks" onClick={() => handleTabChange('tasks')} className="text-xs sm:text-sm px-2 sm:px-3">
                  Tasks
                </TabsTrigger>
              )}
              <TabsTrigger value="tours" onClick={() => handleTabChange('tours')} className="text-xs sm:text-sm px-2 sm:px-3">
                Tours
              </TabsTrigger>
              {!isHost && (
                <TabsTrigger value="bookings" onClick={() => handleTabChange('bookings')} className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Bookings</span>
                  <span className="sm:hidden">Book</span>
                </TabsTrigger>
              )}
              {!isAgent && !isHost && (
                <TabsTrigger value="contacts" onClick={() => handleTabChange('contacts')} className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Contacts</span>
                  <span className="sm:hidden">Contacts</span>
                </TabsTrigger>
              )}
              {isAdminOrManager && (
                <TabsTrigger value="settings" onClick={() => handleTabChange('settings')} className="text-xs sm:text-sm px-2 sm:px-3">
                  <span className="hidden sm:inline">Settings</span>
                  <span className="sm:hidden">Set</span>
                </TabsTrigger>
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
