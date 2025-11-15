
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToursTable } from "@/components/ToursTable";
import { BookingsTable } from "@/components/BookingsTable";
import { ContactsTable } from "@/components/ContactsTable";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { Settings } from "@/pages/Settings";

import { MyTasksWidget } from "@/components/MyTasksWidget";
import { TourDetailModalWithHotelsTab } from "@/components/TourDetailModalWithHotelsTab";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddTourModal } from "@/components/AddTourModal";
import { AddContactModal } from "@/components/AddContactModal";
import { SystemLogModal } from "@/components/SystemLogModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { CustomerAnalyticsModal } from "@/components/CustomerAnalyticsModal";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { useIsMobile } from "@/hooks/use-mobile";


const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabFromUrl = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [selectedTour, setSelectedTour] = useState(null);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addTourModalOpen, setAddTourModalOpen] = useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [systemLogModalOpen, setSystemLogModalOpen] = useState(false);
  const [tourModalDefaultTab, setTourModalDefaultTab] = useState("overview");
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [customerAnalyticsOpen, setCustomerAnalyticsOpen] = useState(false);
  

  const { user, userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const isMobile = useIsMobile();
  
  // Agent users can only access bookings tab
  const isAgent = userRole === 'agent';

  // Update tab when URL changes
  useEffect(() => {
    // Redirect agents to tours if they try to access restricted tabs
    if (isAgent && !['tours', 'bookings'].includes(tabFromUrl)) {
      setSearchParams({ tab: 'tours' });
      setActiveTab('tours');
    } else {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, isAgent, setSearchParams]);

  const { data: bookings = [] } = useBookings();
  const { data: tours = [] } = useTours();
  const { data: tasks = [] } = useTasks();

  // Debug logging
  console.log('[Index] Data status:', { 
    user: user?.id, 
    userRole, 
    tours: tours.length, 
    bookings: bookings.length, 
    tasks: tasks.length 
  });

  // Handle navigation from notifications - stay on current tab
  const handleNavigateToItem = (type: string, itemId: string, hotelId?: string) => {
    if (type === 'tour') {
      const tour = tours.find(t => t.id === itemId);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("overview");
        setTourModalOpen(true);
      }
    } else if (type === 'booking') {
      const tour = tours.find(t => t.id === itemId);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("bookings");
        setTourModalOpen(true);
      }
    } else if (type === 'task') {
      navigate(`/tasks/${itemId}`);
    } else if (type === 'system') {
      setActiveTab("contacts");
    }
  };

  useEffect(() => {
    const handleOpenBookingDetail = (event: CustomEvent) => {
      const { bookingId } = event.detail;
      navigate(`/bookings/${bookingId}`);
    };

    window.addEventListener('open-booking-detail', handleOpenBookingDetail as EventListener);
    
    return () => {
      window.removeEventListener('open-booking-detail', handleOpenBookingDetail as EventListener);
    };
  }, [navigate]);

  const handleAddBooking = () => {
    setAddBookingModalOpen(true);
  };


  const handleViewAllTasks = () => {
    setSearchParams({ tab: "operations" });
    setActiveTab("operations");
    const event = new CustomEvent('navigate-to-all-tasks');
    window.dispatchEvent(event);
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      {!isAgent && (
        <TabsContent value="dashboard" className="space-y-8 mt-0">
          <DashboardQuickActions
            onAddTour={() => setAddTourModalOpen(true)}
            onAddBooking={() => setAddBookingModalOpen(true)}
            onAddContact={() => setAddContactModalOpen(true)}
            onAddTask={() => setAddTaskModalOpen(true)}
          />

          <div className="w-full">
            <MyTasksWidget onViewAllTasks={handleViewAllTasks} />
          </div>
        </TabsContent>
      )}
      
      {!isAgent && (
        <TabsContent value="operations" className="space-y-4 mt-0">
          <OperationsDashboard onNavigateToItem={handleNavigateToItem} />
        </TabsContent>
      )}
      
      <TabsContent value="tours" className="space-y-4 mt-0">
        <ToursTable />
      </TabsContent>
      
      <TabsContent value="bookings" className="space-y-4 mt-0">
        <BookingsTable 
          onAddBooking={handleAddBooking} 
          onViewAnalytics={() => setCustomerAnalyticsOpen(true)}
          onBulkStatusUpdate={() => navigate('/bookings/bulk-status')}
        />
      </TabsContent>
      
      {!isAgent && (
        <TabsContent value="contacts" className="space-y-4 mt-0">
          <ContactsTable />
        </TabsContent>
      )}

      {isAdminOrManager && (
        <TabsContent value="settings" className="space-y-4 mt-0">
          <Settings 
            onBack={() => setActiveTab("dashboard")}
          />
        </TabsContent>
      )}
      {selectedTour && (
        <TourDetailModalWithHotelsTab
          tour={selectedTour}
          open={tourModalOpen}
          onOpenChange={setTourModalOpen}
          defaultTab={tourModalDefaultTab}
        />
      )}

      <AddBookingModal
        open={addBookingModalOpen}
        onOpenChange={setAddBookingModalOpen}
      />

      <SystemLogModal
        open={systemLogModalOpen}
        onOpenChange={setSystemLogModalOpen}
      />

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
      />

      <AddTourModal
        open={addTourModalOpen}
        onOpenChange={setAddTourModalOpen}
      />

      <AddContactModal
        open={addContactModalOpen}
        onOpenChange={setAddContactModalOpen}
      />

      <CustomerAnalyticsModal
        open={customerAnalyticsOpen}
        onOpenChange={setCustomerAnalyticsOpen}
      />
    </Tabs>
  );
};

export default Index;
