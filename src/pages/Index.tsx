
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useBookings } from "@/hooks/useBookings";
import { useTours } from "@/hooks/useTours";

const Index = () => {
  const [activeTab, setActiveTab] = useState("tours");
  const [selectedTour, setSelectedTour] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [tourModalDefaultTab, setTourModalDefaultTab] = useState("overview");

  // Fetch data for navigation purposes
  const { data: bookings = [] } = useBookings();
  const { data: tours = [] } = useTours();

  // Handle navigation from notifications
  const handleNavigateToItem = (type: string, itemId: string, hotelId?: string) => {
    console.log('Navigate to item:', type, itemId, hotelId);
    
    if (type === 'tour') {
      const tour = tours.find(t => t.id === itemId);
      if (tour) {
        setSelectedTour(tour);
        setTourModalDefaultTab("overview");
        setTourModalOpen(true);
      }
      setActiveTab("tours");
    } else if (type === 'booking') {
      const booking = bookings.find(b => b.id === itemId);
      if (booking) {
        setSelectedBooking(booking);
        setBookingModalOpen(true);
      }
      setActiveTab("bookings");
    } else if (type === 'hotel_booking') {
      const booking = bookings.find(b => b.id === itemId);
      if (booking) {
        setSelectedBooking(booking);
        setBookingModalOpen(true);
        // Note: Hotel-specific navigation can be enhanced in EditBookingModal
      }
      setActiveTab("bookings");
    } else if (type === 'task') {
      setActiveTab("operations");
    } else if (type === 'system') {
      setActiveTab("contacts");
    }
  };

  // Handle opening specific booking detail
  useEffect(() => {
    const handleOpenBookingDetail = (event: CustomEvent) => {
      console.log('Received open-booking-detail event:', event.detail);
      const { bookingId, hotelId } = event.detail;
      
      const booking = bookings.find(b => b.id === bookingId);
      console.log('Found booking:', booking);
      
      if (booking) {
        setSelectedBooking(booking);
        setBookingModalOpen(true);
        
        // If hotelId is specified, we might want to navigate to hotel tab in the future
        // For now, just open the booking modal
        if (hotelId === 'auto-navigate') {
          console.log('Auto-navigating to hotel allocation tab');
          // Future enhancement: set default tab to hotel allocation
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
                alt="Luxury Tours Logo" 
                className="h-12 w-auto"
              />
              <h1 className="text-2xl font-bold text-brand-navy">
                Luxury Tours Management
              </h1>
            </div>
            <UserDropdown />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <DashboardMetrics />
          </div>
          <div className="lg:col-span-1">
            <MyNotificationsWidget onNavigateToItem={handleNavigateToItem} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <MyTasksWidget />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tours">Tours</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tours" className="space-y-4">
            <ToursTable />
          </TabsContent>
          
          <TabsContent value="bookings" className="space-y-4">
            <BookingsTable onAddBooking={handleAddBooking} />
          </TabsContent>
          
          <TabsContent value="contacts" className="space-y-4">
            <ContactsTable />
          </TabsContent>
          
          <TabsContent value="operations" className="space-y-4">
            <OperationsDashboard />
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

      <AddBookingModal
        open={addBookingModalOpen}
        onOpenChange={setAddBookingModalOpen}
      />
    </div>
  );
};

export default Index;
