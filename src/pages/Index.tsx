
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, FileText } from "lucide-react";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { ActiveTours } from "@/components/ActiveTours";
import { RecentBookings } from "@/components/RecentBookings";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { AddBookingModal } from "@/components/AddBookingModal";
import { BookingsTable } from "@/components/BookingsTable";
import { ToursTable } from "@/components/ToursTable";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddBooking, setShowAddBooking] = useState(false);

  useEffect(() => {
    const handleNavigateToBookings = () => {
      setActiveTab("bookings");
    };

    window.addEventListener('navigate-to-bookings', handleNavigateToBookings);
    
    return () => {
      window.removeEventListener('navigate-to-bookings', handleNavigateToBookings);
    };
  }, []);

  const handleViewAllTours = () => {
    setActiveTab("tours");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-primary">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
                alt="Australian Racing Tours Logo" 
                className="h-12 w-12"
              />
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">Australian Racing Tours</h1>
                <p className="text-primary-foreground/80">Tour Management System</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tours" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tours
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardMetrics />
            <RecentBookings onAddBooking={() => setShowAddBooking(true)} />
            <ActiveTours onViewAll={handleViewAllTours} />
          </TabsContent>

          <TabsContent value="tours" className="space-y-6">
            <ToursTable showOnlyActive={false} />
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            <BookingsTable onAddBooking={() => setShowAddBooking(true)} />
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <OperationsDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddBookingModal open={showAddBooking} onOpenChange={setShowAddBooking} />
    </div>
  );
};

export default Index;
