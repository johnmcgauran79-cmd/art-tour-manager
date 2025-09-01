
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToursTable } from "@/components/ToursTable";
import { BookingsTable } from "@/components/BookingsTable";
import { ContactsTable } from "@/components/ContactsTable";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { UserDropdown } from "@/components/UserDropdown";
import { DashboardMetrics } from "@/components/DashboardMetrics";

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
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";


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
    } else if (type === 'booking') {
      console.log('Navigating to booking - looking for tour:', itemId);
      const tour = tours.find(t => t.id === itemId);
      console.log('Found tour for booking navigation:', tour);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("bookings");
        console.log('Setting tour modal default tab to bookings');
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


  const handleViewAllTasks = () => {
    setActiveTab("operations");
    setTimeout(() => {
      const event = new CustomEvent('navigate-to-all-tasks');
      window.dispatchEvent(event);
    }, 100);
  };

  if (showUserManagement && isAdmin) {
    return <UserManagement onClose={() => setShowUserManagement(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        isAdmin={isAdmin}
        onShowUserManagement={() => setShowUserManagement(true)}
        onShowSystemLogs={() => setSystemLogModalOpen(true)}
      />

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
    </div>
  );
};

export default Index;
