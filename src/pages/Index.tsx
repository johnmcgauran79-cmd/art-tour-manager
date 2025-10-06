
import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ToursTable } from "@/components/ToursTable";
import { BookingsTable } from "@/components/BookingsTable";
import { ContactsTable } from "@/components/ContactsTable";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { Settings } from "@/pages/Settings";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MyTasksWidget } from "@/components/MyTasksWidget";
import { TourDetailModalWithHotelsTab } from "@/components/TourDetailModalWithHotelsTab";
import { EditBookingModal } from "@/components/EditBookingModal";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddTourModal } from "@/components/AddTourModal";
import { AddContactModal } from "@/components/AddContactModal";
import { SystemLogModal } from "@/components/SystemLogModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CustomerAnalyticsModal } from "@/components/CustomerAnalyticsModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";


const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTour, setSelectedTour] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [addTourModalOpen, setAddTourModalOpen] = useState(false);
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);
  const [systemLogModalOpen, setSystemLogModalOpen] = useState(false);
  const [tourModalDefaultTab, setTourModalDefaultTab] = useState("overview");
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [customerAnalyticsOpen, setCustomerAnalyticsOpen] = useState(false);
  

  const { user, userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const isAdmin = userRole === 'admin';

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
      const task = tasks.find(t => t.id === itemId);
      if (task) {
        setSelectedTask(task);
        setTaskModalOpen(true);
      }
    } else if (type === 'system') {
      setActiveTab("contacts");
    }
  };

  useEffect(() => {
    const handleOpenBookingDetail = (event: CustomEvent) => {
      const { bookingId } = event.detail;
      const booking = bookings.find(b => b.id === bookingId);
      
      if (booking) {
        setSelectedBooking(booking);
        setBookingModalOpen(true);
      }
    };

    window.addEventListener('open-booking-detail', handleOpenBookingDetail as EventListener);
    
    return () => {
      window.removeEventListener('open-booking-detail', handleOpenBookingDetail as EventListener);
    };
  }, [bookings]);

  const handleAddBooking = () => {
    setAddBookingModalOpen(true);
  };


  const handleViewAllTasks = () => {
    setActiveTab("operations");
    const event = new CustomEvent('navigate-to-all-tasks');
    window.dispatchEvent(event);
  };


  return (
    <SidebarProvider defaultOpen={true}>
      <div 
        className="min-h-screen w-full flex flex-col"
        style={{ '--header-height': '95px' } as React.CSSProperties}
      >
        <DashboardHeader isAdmin={isAdmin} />
        
        <div className="flex flex-1 w-full bg-yellow-300">
          <AppSidebar 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isAdminOrManager={isAdminOrManager}
          />
          
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center border-b bg-background px-4 py-2 lg:hidden">
              <SidebarTrigger />
              <span className="ml-2 text-sm font-medium">Menu</span>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                
                <TabsContent value="operations" className="space-y-4 mt-0">
                  <OperationsDashboard onNavigateToItem={handleNavigateToItem} />
                </TabsContent>
                
                <TabsContent value="tours" className="space-y-4 mt-0">
                  <ToursTable />
                </TabsContent>
                
                <TabsContent value="bookings" className="space-y-4 mt-0">
                  <BookingsTable 
                    onAddBooking={handleAddBooking} 
                    onViewAnalytics={() => setCustomerAnalyticsOpen(true)}
                  />
                </TabsContent>
                
                <TabsContent value="contacts" className="space-y-4 mt-0">
                  <ContactsTable />
                </TabsContent>

                {isAdminOrManager && (
                  <TabsContent value="settings" className="space-y-4 mt-0">
                    <Settings 
                      onBack={() => setActiveTab("dashboard")}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {selectedTour && (
        <TourDetailModalWithHotelsTab
          tour={selectedTour}
          open={tourModalOpen}
          onOpenChange={setTourModalOpen}
          defaultTab={tourModalDefaultTab}
        />
      )}

      <EditBookingModal
        booking={selectedBooking}
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
      />

      <TaskDetailModal
        task={selectedTask}
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
      />

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
    </SidebarProvider>
  );
};

export default Index;
