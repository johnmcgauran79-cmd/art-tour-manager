
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, FileText, Contact, UserCog, Plus, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserDropdown } from "@/components/UserDropdown";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { OperationsDashboard } from "@/components/OperationsDashboard";
import { AddBookingModal } from "@/components/AddBookingModal";
import { BookingsTable } from "@/components/BookingsTable";
import { ToursTable } from "@/components/ToursTable";
import { ContactsTable } from "@/components/ContactsTable";
import { UserManagement } from "@/components/UserManagement";
import { PasswordChangeModal } from "@/components/PasswordChangeModal";
import { SystemLogModal } from "@/components/SystemLogModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdminSetup } from "@/components/AdminSetup";
import { MyTasksWidget } from "@/components/MyTasksWidget";
import { AddTourModal } from "@/components/AddTourModal";
import { AddContactModal } from "@/components/AddContactModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const { user, loading, userRole, mustChangePassword } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showAddTour, setShowAddTour] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showSystemLog, setShowSystemLog] = useState(false);

  useEffect(() => {
    const handleNavigateToBookings = () => {
      setActiveTab("bookings");
    };

    const handleNavigateToTours = (event: CustomEvent) => {
      setActiveTab("tours");
      console.log('Navigate to tour:', event.detail?.tourId);
    };

    window.addEventListener('navigate-to-bookings', handleNavigateToBookings);
    window.addEventListener('navigate-to-tours', handleNavigateToTours as EventListener);
    
    return () => {
      window.removeEventListener('navigate-to-bookings', handleNavigateToBookings);
      window.removeEventListener('navigate-to-tours', handleNavigateToTours as EventListener);
    };
  }, []);

  // Show password change modal if user must change password
  useEffect(() => {
    if (user && mustChangePassword && !showPasswordChange) {
      setShowPasswordChange(true);
    }
  }, [user, mustChangePassword, showPasswordChange]);

  // Redirect to login if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handlePasswordChanged = () => {
    window.location.reload();
  };

  // Check if user is admin
  const isAdmin = userRole === 'admin';

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
            <div className="flex items-center gap-4">
              {/* Password change notification */}
              {mustChangePassword && (
                <Button
                  variant="ghost"
                  className="text-primary-foreground border border-primary-foreground/20"
                  onClick={() => setShowPasswordChange(true)}
                >
                  Change Password Required
                </Button>
              )}
              {/* Notification Center */}
              <NotificationCenter />
              {/* System log icon button - only for admins */}
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="System Logs"
                  className="text-primary-foreground"
                  onClick={() => setShowSystemLog(true)}
                >
                  <Settings className="h-6 w-6" />
                </Button>
              )}
              {/* Users icon button shows user management modal - only for admins */}
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Manage Users"
                  className="text-primary-foreground"
                  onClick={() => setShowUserManagement(true)}
                >
                  <UserCog className="h-6 w-6" />
                </Button>
              )}
              {/* User dropdown */}
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {/* Show admin setup if user has no role */}
        {!userRole && (
          <div className="mb-6">
            <AdminSetup />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Contact className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Dashboard Metrics */}
            <DashboardMetrics />
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and actions you can perform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    onClick={() => setShowAddBooking(true)}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Booking
                  </Button>
                  <Button 
                    onClick={() => setShowAddTour(true)}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tour
                  </Button>
                  <Button 
                    onClick={() => setShowAddContact(true)}
                    className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                  <Button 
                    onClick={() => setActiveTab("bookings")}
                    variant="outline"
                  >
                    View All Bookings
                  </Button>
                  <Button 
                    onClick={() => setActiveTab("tours")}
                    variant="outline"
                  >
                    View All Tours
                  </Button>
                  <Button 
                    onClick={() => setActiveTab("contacts")}
                    variant="outline"
                  >
                    View All Contacts
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* My Tasks Widget */}
            <MyTasksWidget />
          </TabsContent>

          <TabsContent value="tours" className="space-y-6">
            <ToursTable showOnlyActive={false} />
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            <BookingsTable onAddBooking={() => setShowAddBooking(true)} />
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <ContactsTable />
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <OperationsDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddBookingModal open={showAddBooking} onOpenChange={setShowAddBooking} />
      <AddTourModal open={showAddTour} onOpenChange={setShowAddTour} />
      <AddContactModal open={showAddContact} onOpenChange={setShowAddContact} />
      {isAdmin && (
        <>
          <Dialog open={showUserManagement} onOpenChange={setShowUserManagement}>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
              <UserManagement />
            </DialogContent>
          </Dialog>
          <SystemLogModal open={showSystemLog} onOpenChange={setShowSystemLog} />
        </>
      )}
      <PasswordChangeModal 
        open={showPasswordChange} 
        onOpenChange={setShowPasswordChange}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
};

export default Index;
