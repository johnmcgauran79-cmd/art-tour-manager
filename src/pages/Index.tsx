
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings } from "lucide-react";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { ActiveTours } from "@/components/ActiveTours";
import { RecentBookings } from "@/components/RecentBookings";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { AddBookingModal } from "@/components/AddBookingModal";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddBooking, setShowAddBooking] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Australian Racing Tours</h1>
              <p className="text-muted-foreground">Tour Management System</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tours" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tours
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardMetrics />
            <RecentBookings onAddBooking={() => setShowAddBooking(true)} />
            <ActiveTours />
          </TabsContent>

          <TabsContent value="tours" className="space-y-6">
            <ActiveTours showAll={true} />
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
