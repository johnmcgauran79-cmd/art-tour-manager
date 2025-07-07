import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToursTable } from "@/components/ToursTable";
import { BookingsTable } from "@/components/BookingsTable";
import { ContactsTable } from "@/components/ContactsTable";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { UserDropdown } from "@/components/UserDropdown";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { MyNotificationsWidget } from "@/components/MyNotificationsWidget";
import { MyTasksWidget } from "@/components/MyTasksWidget";
import { TourDetailModalWithHotelsTab } from "@/components/TourDetailModalWithHotelsTab";
import { EditBookingModal } from "@/components/EditBookingModal";
import { AddBookingModal } from "@/components/AddBookingModal";
import { AddTourModal } from "@/components/AddTourModal";
import { AddContactModal } from "@/components/AddContactModal";
import { SystemLogModal } from "@/components/SystemLogModal";
import { UserManagement } from "@/components/UserManagement";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Users, FileText, Settings, Calendar, MapPin, X, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [systemLogPopoverOpen, setSystemLogPopoverOpen] = useState(false);

  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  const { data: bookings = [] } = useBookings();
  const { data: tours = [] } = useTours();
  const { data: tasks = [] } = useTasks();

  // Handle navigation from notifications - stay on current tab
  const handleNavigateToItem = async (type: string, itemId: string, hotelId?: string) => {
    console.log('handleNavigateToItem called with:', { type, itemId, hotelId });
    
    if (type === 'tour') {
      console.log('Navigating to tour overview:', itemId);
      const tour = tours.find(t => t.id === itemId);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("overview");
        setTourModalOpen(true);
      }
      // Removed setActiveTab("tours") - stay on current tab
    } else if (type === 'booking') {
      console.log('Navigating to booking - looking for tour:', itemId);
      // For booking notifications, itemId is the tour_id, so find the tour and open bookings tab
      const tour = tours.find(t => t.id === itemId);
      console.log('Found tour for booking navigation:', tour);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("bookings");
        console.log('Setting tour modal default tab to bookings');
        setTourModalOpen(true);
      }
      // Removed setActiveTab("tours") - stay on current tab
    } else if (type === 'task') {
      const task = tasks.find(t => t.id === itemId);
      if (task) {
        setSelectedTask(task);
        setTaskModalOpen(true);
      }
      // No tab switching needed - task modal opens over current view
    } else if (type === 'system') {
      // For system notifications, navigate to contacts or appropriate tab
      setActiveTab("contacts");
    }
  };

  useEffect(() => {
    const handleOpenBookingDetail = (event: CustomEvent) => {
      console.log('Received open-booking-detail event:', event.detail);
      const { bookingId, hotelId } = event.detail;
      
      const booking = bookings.find(b => b.id === bookingId);
      console.log('Found booking:', booking);
      
      if (booking) {
        setSelectedBooking(booking);
        setBookingModalOpen(true);
        
        if (hotelId === 'auto-navigate') {
          console.log('Auto-navigating to hotel allocation tab');
        }
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

  const handleViewAllNotifications = () => {
    setActiveTab("operations");
    // Add a small delay to ensure the operations tab loads before navigating to all notifications
    setTimeout(() => {
      const event = new CustomEvent('navigate-to-all-notifications');
      window.dispatchEvent(event);
    }, 100);
  };

  const handleViewAllTasks = () => {
    setActiveTab("operations");
    // Add a small delay to ensure the operations tab loads before navigating to all tasks
    setTimeout(() => {
      const event = new CustomEvent('navigate-to-all-tasks');
      window.dispatchEvent(event);
    }, 100);
  };

  const quickActions = [
    {
      icon: Plus,
      label: "New Tour",
      onClick: () => setAddTourModalOpen(true),
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Calendar,
      label: "New Booking",
      onClick: () => setAddBookingModalOpen(true),
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Users,
      label: "Add Contact",
      onClick: () => setAddContactModalOpen(true),
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Plus,
      label: "Add Task",
      onClick: () => setAddTaskModalOpen(true),
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    }
  ];

  if (showUserManagement && isAdmin) {
    return <UserManagement onClose={() => setShowUserManagement(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-navy border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
                alt="Australian Racing Tours Logo" 
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-brand-yellow">
                  Australian Racing Tours
                </h1>
                <p className="text-sm text-white">
                  Tour Operations Management System
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-brand-navy/80 p-2"
                    onClick={() => setShowUserManagement(true)}
                  >
                    <Users className="h-5 w-5" />
                  </Button>

                  <Popover open={systemLogPopoverOpen} onOpenChange={setSystemLogPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-brand-navy/80 p-2"
                      >
                        <FileText className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">System Logs</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSystemLogPopoverOpen(false)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        View system activity logs, audit trails, and operational history.
                      </p>
                      <Button
                        onClick={() => {
                          setSystemLogModalOpen(true);
                          setSystemLogPopoverOpen(false);
                        }}
                        className="w-full"
                      >
                        View System Logs
                      </Button>
                    </PopoverContent>
                  </Popover>
                </>
              )}
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="tours">Tours</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-8">
            <DashboardMetrics />

            <Card className="border-brand-navy/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-brand-navy flex items-center gap-2">
                  <Settings className="h-6 w-6" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      onClick={action.onClick}
                      className={`${action.color} h-10 flex items-center justify-center space-x-2 hover:scale-105 transition-transform`}
                    >
                      <action.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-brand-navy/20 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-brand-navy" />
                    <CardTitle className="text-brand-navy">Recent Notifications</CardTitle>
                  </div>
                  <Button
                    onClick={handleViewAllNotifications}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    View All Notifications
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MyNotificationsWidget 
                  onNavigateToItem={handleNavigateToItem} 
                  showCard={false} 
                />
              </CardContent>
            </Card>

            <div className="w-full">
              <MyTasksWidget onViewAllTasks={handleViewAllTasks} />
            </div>
          </TabsContent>
          
          <TabsContent value="operations" className="space-y-4">
            <OperationsDashboard onNavigateToItem={handleNavigateToItem} />
          </TabsContent>
          
          <TabsContent value="tours" className="space-y-4">
            <ToursTable />
          </TabsContent>
          
          <TabsContent value="bookings" className="space-y-4">
            <BookingsTable onAddBooking={handleAddBooking} />
          </TabsContent>
          
          <TabsContent value="contacts" className="space-y-4">
            <ContactsTable />
          </TabsContent>
        </Tabs>
      </div>

      <TourDetailModalWithHotelsTab
        tour={selectedTour}
        open={tourModalOpen}
        onOpenChange={setTourModalOpen}
        defaultTab={tourModalDefaultTab}
      />

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

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
      />
    </div>
  );
};

export default Index;
